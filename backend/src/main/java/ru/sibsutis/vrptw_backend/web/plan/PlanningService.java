package ru.sibsutis.vrptw_backend.web.plan;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import ai.timefold.solver.core.api.solver.SolverFactory;
import ai.timefold.solver.core.config.solver.SolverConfig;
import ru.sibsutis.vrptw_backend.domain.constraint.DispatchConstraintProvider;
import ru.sibsutis.vrptw_backend.domain.model.DaySolution;
import ru.sibsutis.vrptw_backend.domain.model.Staff;
import ru.sibsutis.vrptw_backend.domain.model.Visit;
import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.day.Order;
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.plan.PlanSummary;
import ru.sibsutis.vrptw_backend.dto.plan.Route;
import ru.sibsutis.vrptw_backend.dto.plan.Stop;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;
import ru.sibsutis.vrptw_backend.service.DaySolutionFactory;
import ru.sibsutis.vrptw_backend.web.pgp.PgpDetector;
import ru.sibsutis.vrptw_backend.web.storage.DataStore;

@Service
public class PlanningService {

    private final DataStore store;
    private final SolverFactory<DaySolution> solverFactory;   
    private final SolverFactory<DaySolution> replanFactory;
    private final PgpDetector pgp;
    private final PlanAssembler assembler;
    private final PlanMerger merger;
    private final DaySolutionFactory factory = new DaySolutionFactory();
    private final ReentrantLock lock = new ReentrantLock();

    public PlanningService(DataStore store, SolverFactory<DaySolution> solverFactory,
                           PgpDetector pgp, PlanAssembler assembler, PlanMerger merger) {
        this.store = store;
        this.solverFactory = solverFactory;
        this.pgp = pgp;
        this.assembler = assembler;
        this.merger = merger;
        this.replanFactory = SolverFactory.create(new SolverConfig()
                .withSolutionClass(DaySolution.class)
                .withEntityClasses(Staff.class, Visit.class)
                .withConstraintProviderClass(DispatchConstraintProvider.class)
                .withTerminationSpentLimit(Duration.ofSeconds(5)));
    }

    public Plan plan(LocalDate date) {
        if (store.hasEvents(date)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "После событий план меняется только через POST /events");
        }
        DayInput day = store.findDay(date).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Наряды не загружены: PUT /api/v1/days/" + date));
        return solve(date, day.now(), null, Map.of(), false);
    }

    /** День с учётом событий: используется UI, чтобы показать те же наряды, что видит солвер. */
    public DayInput currentDay(LocalDate date) {
        DayInput day = store.findDay(date).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Наряды не загружены: PUT /api/v1/days/" + date));
        return effectiveDay(day, store.now(date));
    }

    public Plan replan(LocalDate date, OffsetDateTime ts, String eventId, Map<String, List<Stop>> completedPrefix) {
        return solve(date, ts, eventId, completedPrefix, true);
    }

    private Plan solve(LocalDate date, OffsetDateTime now, String eventId,
                       Map<String, List<Stop>> prefix, boolean isReplan) {
        ReferenceData ref = store.findReference().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "Справочники не загружены"));
        TravelMatrix matrix = store.findTravelMatrix().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "Матрица не загружена"));
        DayInput day = store.findDay(date).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Наряды не загружены"));
        if (!lock.tryLock()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Планирование уже выполняется");
        }
        try {
            long t0 = System.nanoTime();
            DayInput effective = effectiveDay(day, now);

            Set<String> started = new HashSet<>();
            prefix.values().forEach(stops -> stops.stream()
                    .filter(s -> "VISIT".equals(s.type()) && s.orderId() != null)
                    .forEach(s -> started.add(s.orderId())));

            PgpDetector.Result pgpRes = pgp.detect(effective, ref, now, started);
            List<Order> plannedOrders = pgpRes.plannedOrders().stream()
                    .filter(o -> !started.contains(o.orderId()))
                    .toList();
            DayInput planned = new DayInput(date, now, plannedOrders, effective.absentStaffIds());

            DaySolution problem = factory.build(ref, planned, matrix);
            applyCompletedPrefixFloor(problem, prefix, now);
            DaySolution solved = (isReplan ? replanFactory : solverFactory).buildSolver().solve(problem);
            long ms = (System.nanoTime() - t0) / 1_000_000;

            int version = isReplan ? store.bumpVersion(date) : 1;
            if (!isReplan) {
                store.setInitialVersion(date);
            }

            Plan fresh = assembler.assemble(solved, effective, pgpRes.groups(), version, ms, ref);
            Plan merged = merger.merge(fresh, prefix, ref, now);
            merged = merger.withDayState(merged, store.cancelled(date), eventId);
            merged = merger.withAlerts(merged, store.alerts(date), effective, now);
            merged = resummarize(merged);
            store.setAlerts(date, merged.alerts());
            store.savePlan(date, merged);
            return merged;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Остаток маршрута не может начаться раньше конца уже начатого визита
     * (VISIT_DELAYED / ORDER_TRANSFERRED сдвигают end вперёд), иначе H6 ломается.
     */
    private void applyCompletedPrefixFloor(DaySolution problem, Map<String, List<Stop>> prefix,
                                           OffsetDateTime now) {
        Map<String, OffsetDateTime> floors = new HashMap<>();
        prefix.forEach((staffId, stops) -> {
            OffsetDateTime last = null;
            for (Stop s : stops) if (s.end() != null && (last == null || s.end().isAfter(last))) last = s.end();
            if (last != null && last.isAfter(now)) floors.put(staffId, last);
        });
        for (Staff staff : problem.getStaff()) {
            OffsetDateTime floor = floors.get(staff.getStaffId());
            if (floor != null) staff.setAvailableFrom(floor);
        }
    }

    /** Солвер видел только остаток дня; после мерджа префикса сводка считается по всем маршрутам. */
    private Plan resummarize(Plan plan) {
        int visits = 0;
        long travel = 0;
        List<Double> utilizations = new ArrayList<>();
        for (Route route : plan.routes()) {
            visits += route.totals().visits();
            travel += route.totals().travelSec();
            utilizations.add(route.totals().utilization());
        }
        PlanSummary s = plan.summary();
        PlanSummary sum = new PlanSummary(s.ordersTotal(), visits, s.unassigned(), s.pgpOrders(),
                s.cancelled(), travel, cv(utilizations));
        return new Plan(plan.date(), plan.planVersion(), plan.basedOnEventId(), plan.asOf(),
                plan.computationMs(), plan.routes(), plan.unassigned(), plan.pgpGroups(),
                plan.cancelled(), plan.alerts(), sum);
    }

    private static double cv(List<Double> values) {
        if (values.size() < 2) {
            return 0;
        }
        double mean = values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        if (mean == 0) {
            return 0;
        }
        double variance = values.stream().mapToDouble(v -> (v - mean) * (v - mean)).average().orElse(0);
        return Math.sqrt(variance) / mean;
    }

    private DayInput effectiveDay(DayInput base, OffsetDateTime now) {
        List<Order> orders = new ArrayList<>(base.orders() == null ? List.of() : base.orders());
        orders.removeIf(o -> store.removedOrders(base.date()).contains(o.orderId()));
        orders.addAll(store.extraOrders(base.date()));
        Set<String> absent = new LinkedHashSet<>(base.absentStaffIds() == null ? List.of() : base.absentStaffIds());
        absent.addAll(store.unavailableStaff(base.date()));
        return new DayInput(base.date(), now, orders, new ArrayList<>(absent));
    }
}