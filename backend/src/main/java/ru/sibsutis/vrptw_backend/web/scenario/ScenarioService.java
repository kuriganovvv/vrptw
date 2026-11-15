package ru.sibsutis.vrptw_backend.web.scenario;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import ai.timefold.solver.core.api.solver.SolverFactory;
import ai.timefold.solver.core.config.solver.SolverConfig;
import ru.sibsutis.vrptw_backend.domain.constraint.DispatchConstraintProvider;
import ru.sibsutis.vrptw_backend.domain.model.DaySolution;
import ru.sibsutis.vrptw_backend.domain.model.Staff;
import ru.sibsutis.vrptw_backend.dto.common.Equipment;
import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.day.Order;
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.plan.PlanSummary;
import ru.sibsutis.vrptw_backend.dto.plan.Route;
import ru.sibsutis.vrptw_backend.dto.plan.Stop;
import ru.sibsutis.vrptw_backend.dto.plan.UnassignedOrder;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;
import ru.sibsutis.vrptw_backend.dto.scenario.EquipmentAdvice;
import ru.sibsutis.vrptw_backend.dto.scenario.EquipmentRecommendation;
import ru.sibsutis.vrptw_backend.dto.scenario.ScenarioDelta;
import ru.sibsutis.vrptw_backend.dto.scenario.ScenarioMetrics;
import ru.sibsutis.vrptw_backend.dto.scenario.ScenarioRequest;
import ru.sibsutis.vrptw_backend.dto.scenario.ScenarioResult;
import ru.sibsutis.vrptw_backend.service.DaySolutionFactory;
import ru.sibsutis.vrptw_backend.service.JointVisitFinalizer;
import ru.sibsutis.vrptw_backend.web.pgp.PgpDetector;
import ru.sibsutis.vrptw_backend.web.plan.PlanAssembler;
import ru.sibsutis.vrptw_backend.web.plan.PlanningService;
import ru.sibsutis.vrptw_backend.web.storage.DataStore;

/**
 * Сценарный анализ: «что будет, если на смену выйдет на N сотрудников меньше»
 * и «какой запас АО нужен в рюкзаке, чтобы не заезжать в СЦ».
 *
 * <p>Базовый и сценарный планы решаются одним и тем же солвером с одинаковым
 * лимитом времени, чтобы сравнение метрик было честным. Рабочий план дня при
 * этом не изменяется: результат сценария — только ответ на запрос.</p>
 */
@Service
public class ScenarioService {

    private static final int MAX_STAFF_DELTA = 100;
    private static final int MIN_TIME_LIMIT_SEC = 1;
    private static final String NOTE = "Оценка по маршрутам базового плана: чтобы не заезжать в СЦ, "
            + "стартовый запас должен покрывать суммарную потребность в АО по всем визитам маршрута, "
            + "а вместимость рюкзака — быть не меньше стартового запаса.";

    private final DataStore store;
    private final PlanningService planning;
    private final PgpDetector pgp;
    private final PlanAssembler assembler;
    private final DaySolutionFactory factory = new DaySolutionFactory();
    private final Map<Integer, SolverFactory<DaySolution>> factories = new ConcurrentHashMap<>();
    private final ReentrantLock lock = new ReentrantLock();
    private final int defaultTimeLimitSec;
    private final int maxTimeLimitSec;
    private final boolean restockEnabled;

    public ScenarioService(DataStore store, PlanningService planning, PgpDetector pgp,
                           PlanAssembler assembler,
                           @Value("${dispatch.scenario.time-limit-sec:5}") int defaultTimeLimitSec,
                           @Value("${dispatch.scenario.max-time-limit-sec:60}") int maxTimeLimitSec,
                           @Value("${dispatch.restock.enabled:true}") boolean restockEnabled) {
        this.store = store;
        this.planning = planning;
        this.pgp = pgp;
        this.assembler = assembler;
        this.defaultTimeLimitSec = defaultTimeLimitSec;
        this.maxTimeLimitSec = maxTimeLimitSec;
        this.restockEnabled = restockEnabled;
    }

    public ScenarioResult analyze(LocalDate date, ScenarioRequest request) {
        ScenarioRequest req = request == null ? ScenarioRequest.empty() : request;
        int requestedDelta = req.staffDelta() == null ? 0 : req.staffDelta();
        if (requestedDelta > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "staff_delta должен быть отрицательным или нулём: сценарий моделирует нехватку сотрудников");
        }
        if (requestedDelta < -MAX_STAFF_DELTA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "staff_delta не может быть меньше -" + MAX_STAFF_DELTA);
        }
        if (req.equipmentStart() != null && Boolean.TRUE.equals(req.useRecommendedEquipment())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Укажите либо equipment_start, либо use_recommended_equipment");
        }
        int timeLimitSec = clamp(req.timeLimitSec() == null ? defaultTimeLimitSec : req.timeLimitSec());

        if (!lock.tryLock()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Сценарный анализ уже выполняется");
        }
        try {
            long t0 = System.nanoTime();
            ReferenceData reference = store.findReference().orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.CONFLICT, "Справочники не загружены"));
            TravelMatrix matrix = store.findTravelMatrix().orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.CONFLICT, "Матрица не загружена"));
            DayInput effectiveDay = planning.currentDay(date);
            OffsetDateTime now = effectiveDay.now();

            PgpDetector.Result pgpResult = pgp.detect(effectiveDay, reference, now, Set.of());
            DayInput plannedDay = new DayInput(date, now, pgpResult.plannedOrders(),
                    effectiveDay.absentStaffIds());

            Plan baseline = solvePlan(reference, matrix, plannedDay, effectiveDay, pgpResult.groups(),
                    timeLimitSec, Set.of(), Map.of(), Map.of());
            EquipmentRecommendation recommendation = equipmentRecommendation(baseline, effectiveDay, reference);

            List<String> excluded = excludedStaff(req, requestedDelta, baseline, reference);
            Map<String, Equipment> startOverrides = new HashMap<>();
            Map<String, Equipment> capacityOverrides = new HashMap<>();
            applyExplicitEquipment(req, reference, startOverrides, capacityOverrides);
            if (Boolean.TRUE.equals(req.useRecommendedEquipment())) {
                for (EquipmentAdvice advice : recommendation.staff()) {
                    startOverrides.put(advice.staffId(), advice.requiredStart());
                    capacityOverrides.put(advice.staffId(), advice.requiredCapacity());
                }
            }

            Plan scenario = solvePlan(reference, matrix, plannedDay, effectiveDay, pgpResult.groups(),
                    timeLimitSec, new HashSet<>(excluded), startOverrides, capacityOverrides);

            ScenarioMetrics baselineMetrics = metrics(baseline, effectiveDay);
            ScenarioMetrics scenarioMetrics = metrics(scenario, effectiveDay);
            long computationMs = (System.nanoTime() - t0) / 1_000_000;

            return new ScenarioResult(date, now, computationMs, timeLimitSec, -excluded.size(), excluded,
                    baselineMetrics, scenarioMetrics, delta(baselineMetrics, scenarioMetrics),
                    newlyUnassigned(baseline, scenario), recommendation, scenario);
        } finally {
            lock.unlock();
        }
    }

    private int clamp(int requested) {
        if (requested < MIN_TIME_LIMIT_SEC) {
            return MIN_TIME_LIMIT_SEC;
        }
        return Math.min(requested, Math.max(MIN_TIME_LIMIT_SEC, maxTimeLimitSec));
    }

    private Plan solvePlan(ReferenceData reference, TravelMatrix matrix, DayInput plannedDay,
                           DayInput effectiveDay, List<ru.sibsutis.vrptw_backend.dto.plan.PgpGroup> groups,
                           int timeLimitSec, Set<String> extraAbsent,
                           Map<String, Equipment> startOverrides,
                           Map<String, Equipment> capacityOverrides) {
        Set<String> absent = new LinkedHashSet<>(
                plannedDay.absentStaffIds() == null ? List.of() : plannedDay.absentStaffIds());
        absent.addAll(extraAbsent);
        DayInput scoped = new DayInput(plannedDay.date(), plannedDay.now(), plannedDay.orders(),
                new ArrayList<>(absent));

        DaySolution problem = factory.build(reference, scoped, matrix);
        problem.setRestockEnabled(restockEnabled);
        for (Staff staff : problem.getStaff()) {
            Equipment start = startOverrides.get(staff.getStaffId());
            if (start != null) {
                var domainStart = toDomain(start);
                staff.setEquipmentStart(domainStart);
                staff.setEquipmentCapacity(maxDomain(staff.getEquipmentCapacity(), domainStart));
            }
            Equipment capacity = capacityOverrides.get(staff.getStaffId());
            if (capacity != null) {
                staff.setEquipmentCapacity(toDomain(capacity));
            }
        }

        long t0 = System.nanoTime();
        SolverFactory<DaySolution> usedFactory = factoryFor(timeLimitSec);
        DaySolution solved = usedFactory.buildSolver().solve(problem);
        JointVisitFinalizer.dropIncompletePairs(solved, usedFactory);
        long ms = (System.nanoTime() - t0) / 1_000_000;
        return assembler.assemble(solved, effectiveDay, groups, 0, ms, reference);
    }

    private SolverFactory<DaySolution> factoryFor(int timeLimitSec) {
        return factories.computeIfAbsent(timeLimitSec, seconds -> SolverFactory.create(new SolverConfig()
                .withSolutionClass(DaySolution.class)
                .withEntityClasses(Staff.class, ru.sibsutis.vrptw_backend.domain.model.Visit.class)
                .withConstraintProviderClass(DispatchConstraintProvider.class)
                .withTerminationSpentLimit(Duration.ofSeconds(seconds))));
    }

    private void applyExplicitEquipment(ScenarioRequest req, ReferenceData reference,
                                        Map<String, Equipment> startOverrides,
                                        Map<String, Equipment> capacityOverrides) {
        if (reference.staff() == null) {
            return;
        }
        for (var staff : reference.staff()) {
            if (req.equipmentStart() != null) {
                startOverrides.put(staff.staffId(), req.equipmentStart());
            }
            if (req.equipmentCapacity() != null) {
                capacityOverrides.put(staff.staffId(), req.equipmentCapacity());
            }
        }
    }

    /**
     * Явный список выбывших важнее staff_delta. Без списка убираем наименее
     * загруженных сотрудников базового плана: так сценарий детерминирован и
     * отвечает на вопрос «кто уйдёт, если сократить смену».
     */
    private List<String> excludedStaff(ScenarioRequest req, int delta, Plan baseline, ReferenceData reference) {
        if (req.excludedStaffIds() != null && !req.excludedStaffIds().isEmpty()) {
            Set<String> known = new LinkedHashSet<>();
            if (reference.staff() != null) {
                reference.staff().forEach(s -> known.add(s.staffId()));
            }
            List<String> result = new ArrayList<>();
            for (String id : req.excludedStaffIds()) {
                if (!known.contains(id)) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "Неизвестный сотрудник: " + id);
                }
                if (!result.contains(id)) {
                    result.add(id);
                }
            }
            return result;
        }
        if (delta >= 0 || baseline.routes() == null || baseline.routes().isEmpty()) {
            return List.of();
        }
        int count = Math.min(-delta, baseline.routes().size());
        return baseline.routes().stream()
                .sorted(Comparator
                        .comparingInt((Route route) -> visits(route))
                        .thenComparingDouble(this::utilization)
                        .thenComparing(Route::staffId))
                .limit(count)
                .map(Route::staffId)
                .toList();
    }

    private static int visits(Route route) {
        return route.totals() == null || route.totals().visits() == null ? 0 : route.totals().visits();
    }

    private double utilization(Route route) {
        return route.totals() == null || route.totals().utilization() == null
                ? 0
                : route.totals().utilization();
    }

    private ScenarioMetrics metrics(Plan plan, DayInput day) {
        Map<String, Order> orders = orderMap(day);
        int visits = 0;
        int slotHits = 0;
        int deadlineHits = 0;
        int restockStops = 0;
        long restockMin = 0;
        long travelSec = 0;
        long distanceM = 0;
        // Совместный наряд даёт по визиту в маршруте каждого из двух сотрудников,
        // но для метрик это один наряд: иначе он посчитается дважды.
        Set<String> countedOrders = new HashSet<>();

        for (Route route : plan.routes() == null ? List.<Route>of() : plan.routes()) {
            if (route.totals() != null) {
                travelSec += route.totals().travelSec() == null ? 0 : route.totals().travelSec();
                distanceM += route.totals().distanceM() == null ? 0 : route.totals().distanceM();
            }
            for (Stop stop : route.stops() == null ? List.<Stop>of() : route.stops()) {
                if ("VISIT".equals(stop.type())) {
                    if (stop.orderId() != null && !countedOrders.add(stop.orderId())) {
                        continue;
                    }
                    visits++;
                    Order order = stop.orderId() == null ? null : orders.get(stop.orderId());
                    if (order != null && stop.start() != null) {
                        if (!stop.start().isBefore(order.slot().start())
                                && !stop.start().isAfter(order.latestStart())) {
                            slotHits++;
                        }
                        if (stop.end() != null && order.deadline() != null
                                && !stop.end().isAfter(order.deadline())) {
                            deadlineHits++;
                        }
                    }
                } else if ("RESTOCK".equals(stop.type())) {
                    restockStops++;
                    if (stop.start() != null && stop.end() != null) {
                        restockMin += Duration.between(stop.start(), stop.end()).toMinutes();
                    }
                }
            }
        }

        PlanSummary summary = plan.summary();
        int ordersTotal = summary == null || summary.ordersTotal() == null ? 0 : summary.ordersTotal();
        int unassigned = plan.unassigned() == null ? 0 : plan.unassigned().size();
        int pgpOrders = plan.pgpGroups() == null ? 0
                : plan.pgpGroups().stream().mapToInt(g -> g.orderIds().size()).sum();
        double cv = summary == null || summary.utilizationCv() == null ? 0 : summary.utilizationCv();
        return new ScenarioMetrics(
                plan.routes() == null ? 0 : plan.routes().size(),
                ordersTotal,
                visits,
                unassigned,
                pgpOrders,
                slotHits,
                deadlineHits,
                visits == 0 ? 0 : (double) slotHits / visits,
                visits == 0 ? 0 : (double) deadlineHits / visits,
                travelSec,
                distanceM,
                cv,
                restockStops,
                restockMin);
    }

    private static ScenarioDelta delta(ScenarioMetrics baseline, ScenarioMetrics scenario) {
        return new ScenarioDelta(
                scenario.visitsPlanned() - baseline.visitsPlanned(),
                scenario.unassigned() - baseline.unassigned(),
                scenario.slotHits() - baseline.slotHits(),
                scenario.deadlineHits() - baseline.deadlineHits(),
                scenario.travelSecTotal() - baseline.travelSecTotal(),
                scenario.distanceMTotal() - baseline.distanceMTotal(),
                scenario.utilizationCv() - baseline.utilizationCv(),
                scenario.restockStops() - baseline.restockStops());
    }

    private List<UnassignedOrder> newlyUnassigned(Plan baseline, Plan scenario) {
        Set<String> before = new LinkedHashSet<>();
        if (baseline.unassigned() != null) {
            baseline.unassigned().forEach(item -> before.add(item.orderId()));
        }
        List<UnassignedOrder> result = new ArrayList<>();
        if (scenario.unassigned() != null) {
            for (UnassignedOrder item : scenario.unassigned()) {
                if (!before.contains(item.orderId())) {
                    result.add(item);
                }
            }
        }
        result.sort(Comparator.comparing(UnassignedOrder::orderId));
        return result;
    }

    private EquipmentRecommendation equipmentRecommendation(Plan plan, DayInput day, ReferenceData reference) {
        Map<String, Order> orders = orderMap(day);
        Map<String, ru.sibsutis.vrptw_backend.dto.reference.Staff> staffById = new LinkedHashMap<>();
        if (reference.staff() != null) {
            reference.staff().forEach(staff -> staffById.put(staff.staffId(), staff));
        }

        List<EquipmentAdvice> advice = new ArrayList<>();
        int restockTotal = 0;
        Equipment totalAdditionalStart = zero();
        Equipment totalAdditionalCapacity = zero();
        // Оборудование совместного наряда везёт только основной сотрудник:
        // учитываем потребность один раз, а не в обоих маршрутах.
        Set<String> countedOrders = new HashSet<>();

        for (Route route : plan.routes() == null ? List.<Route>of() : plan.routes()) {
            int visits = 0;
            int restockStops = 0;
            Equipment required = zero();
            for (Stop stop : route.stops() == null ? List.<Stop>of() : route.stops()) {
                if ("RESTOCK".equals(stop.type())) {
                    restockStops++;
                } else if ("VISIT".equals(stop.type())) {
                    visits++;
                    Order order = stop.orderId() == null ? null : orders.get(stop.orderId());
                    if (order != null
                            && (stop.orderId() == null || countedOrders.add(stop.orderId()))) {
                        required = plus(required, equipment(order.requiredEquipment()));
                    }
                }
            }
            restockTotal += restockStops;
            if (visits == 0) {
                continue;
            }

            var staffRef = staffById.get(route.staffId());
            Equipment currentStart = staffRef == null ? zero() : equipment(staffRef.equipmentStart());
            Equipment currentCapacity = staffRef == null ? zero() : equipment(staffRef.equipmentCapacity());
            Equipment requiredStart = required;
            Equipment requiredCapacity = max(currentCapacity, requiredStart);
            Equipment additionalStart = subtractFloorZero(requiredStart, currentStart);
            Equipment additionalCapacity = subtractFloorZero(requiredCapacity, currentCapacity);
            totalAdditionalStart = plus(totalAdditionalStart, additionalStart);
            totalAdditionalCapacity = plus(totalAdditionalCapacity, additionalCapacity);
            advice.add(new EquipmentAdvice(
                    route.staffId(),
                    staffRef == null ? route.staffId() : staffRef.displayName(),
                    visits,
                    restockStops,
                    currentStart,
                    requiredStart,
                    additionalStart,
                    currentCapacity,
                    requiredCapacity,
                    additionalCapacity));
        }

        advice.sort(Comparator
                .comparingInt((EquipmentAdvice item) -> equipmentSum(item.additionalStart()))
                .reversed()
                .thenComparing(EquipmentAdvice::staffId));

        return new EquipmentRecommendation(restockTotal, advice,
                totalAdditionalStart, totalAdditionalCapacity, NOTE);
    }

    private static Map<String, Order> orderMap(DayInput day) {
        Map<String, Order> result = new LinkedHashMap<>();
        if (day.orders() != null) {
            day.orders().forEach(order -> result.put(order.orderId(), order));
        }
        return result;
    }

    private static Equipment equipment(ru.sibsutis.vrptw_backend.dto.common.Equipment dto) {
        return dto == null ? zero() : new Equipment(dto.ont(), dto.router(), dto.stb());
    }

    private static Equipment zero() {
        return new Equipment(0, 0, 0);
    }

    private static Equipment plus(Equipment a, Equipment b) {
        return new Equipment(a.ont() + b.ont(), a.router() + b.router(), a.stb() + b.stb());
    }

    private static ru.sibsutis.vrptw_backend.domain.model.Equipment toDomain(Equipment dto) {
        return ru.sibsutis.vrptw_backend.domain.model.Equipment.of(dto.ont(), dto.router(), dto.stb());
    }

    private static ru.sibsutis.vrptw_backend.domain.model.Equipment maxDomain(
            ru.sibsutis.vrptw_backend.domain.model.Equipment a,
            ru.sibsutis.vrptw_backend.domain.model.Equipment b) {
        return ru.sibsutis.vrptw_backend.domain.model.Equipment.of(
                Math.max(a.ont(), b.ont()),
                Math.max(a.router(), b.router()),
                Math.max(a.stb(), b.stb()));
    }

    private static Equipment max(Equipment a, Equipment b) {
        return new Equipment(
                Math.max(a.ont(), b.ont()),
                Math.max(a.router(), b.router()),
                Math.max(a.stb(), b.stb()));
    }

    private static Equipment subtractFloorZero(Equipment required, Equipment current) {
        return new Equipment(
                Math.max(0, required.ont() - current.ont()),
                Math.max(0, required.router() - current.router()),
                Math.max(0, required.stb() - current.stb()));
    }

    private static int equipmentSum(Equipment equipment) {
        return equipment.ont() + equipment.router() + equipment.stb();
    }
}
