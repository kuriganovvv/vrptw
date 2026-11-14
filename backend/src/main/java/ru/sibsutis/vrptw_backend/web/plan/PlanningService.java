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
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.plan.Stop;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;
import ru.sibsutis.vrptw_backend.service.DaySolutionFactory;
import ru.sibsutis.vrptw_backend.web.pgp.PgpDetector;
import ru.sibsutis.vrptw_backend.web.storage.InMemoryDataStore;

@Service
public class PlanningService {

    private final InMemoryDataStore store;
    private final SolverFactory<DaySolution> solverFactory;      // 120s из yml (Влад)
    private final SolverFactory<DaySolution> replanFactory;     // 5s, чтобы событие ≤10s
    private final PgpDetector pgp;
    private final PlanAssembler assembler;
    private final PlanMerger merger;
    private final DaySolutionFactory factory = new DaySolutionFactory();
    private final ReentrantLock lock = new ReentrantLock();

    public PlanningService(InMemoryDataStore store, SolverFactory<DaySolution> solverFactory,
                           PgpDetector pgp, PlanAssembler assembler, PlanMerger merger) {
        this.store = store; this.solverFactory = solverFactory; this.pgp = pgp;
        this.assembler = assembler; this.merger = merger;
        this.replanFactory = SolverFactory.create(new SolverConfig()
                .withSolutionClass(DaySolution.class)
                .withEntityClasses(Staff.class, Visit.class)
                .withConstraintProviderClass(DispatchConstraintProvider.class)
                .withTerminationSpentLimit(Duration.ofSeconds(5)));
    }

    public Plan plan(LocalDate date) {
        if (store.hasEvents(date))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "После событий план меняется только через POST /events");
        return solve(date, store.now(date), null, Map.of(), false);
    }

    public Plan replan(LocalDate date, OffsetDateTime ts, String eventId, Map<String, List<Stop>> completedPrefix) {
        return solve(date, ts, eventId, completedPrefix, true);
    }

    private Plan solve(LocalDate date, OffsetDateTime now, String eventId,
                       Map<String, List<Stop>> prefix, boolean isReplan) {
        ReferenceData ref = store.findReference().orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Справочники не загружены"));
        TravelMatrix matrix = store.findTravelMatrix().orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Матрица не загружена"));
        DayInput day = store.findDay(date).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Наряды не загружены"));
        if (!lock.tryLock()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Планирование уже выполняется");
        try {
            long t0 = System.nanoTime();
            DayInput effective = effectiveDay(day, now);
            Set<String> started = new HashSet<>();
            prefix.values().forEach(stops -> stops.stream().filter(s -> "VISIT".equals(s.type()) && s.orderId() != null).forEach(s -> started.add(s.orderId())));
            PgpDetector.Result pgpRes = pgp.detect(effective, ref, now, started);
            DayInput planned = new DayInput(date, now, pgpRes.plannedOrders(), effective.absentStaffIds());
            DaySolution solved = (isReplan ? replanFactory : solverFactory).buildSolver().solve(factory.build(ref, planned, matrix));
            long ms = (System.nanoTime() - t0) / 1_000_000;
            int version = isReplan ? store.bumpVersion(date) : 1;
            if (!isReplan) store.setInitialVersion(date);
            Plan fresh = assembler.assemble(solved, effective, pgpRes.groups(), version, ms);
            Plan merged = merger.merge(fresh, prefix, ref, now);
            merged = merger.withAlerts(merged, store.alerts(date), effective, now);
            store.setAlerts(date, merged.alerts());
            store.savePlan(date, merged);
            return merged;
        } finally { lock.unlock(); }
    }

    private DayInput effectiveDay(DayInput base, OffsetDateTime now) {
        List<ru.sibsutis.vrptw_backend.dto.day.Order> orders = new ArrayList<>(base.orders() == null ? List.of() : base.orders());
        orders.removeIf(o -> store.removedOrders(base.date()).contains(o.orderId()));
        orders.addAll(store.extraOrders(base.date()));
        Set<String> absent = new LinkedHashSet<>(base.absentStaffIds() == null ? List.of() : base.absentStaffIds());
        absent.addAll(store.unavailableStaff(base.date()));
        return new DayInput(base.date(), now, orders, new ArrayList<>(absent));
    }
}