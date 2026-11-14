package ru.sibsutis.vrptw_backend.web.events;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import ru.sibsutis.vrptw_backend.dto.day.Order;
import ru.sibsutis.vrptw_backend.dto.event.EventResult;
import ru.sibsutis.vrptw_backend.dto.plan.CancelledOrder;
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.plan.Stop;
import ru.sibsutis.vrptw_backend.web.plan.PlanningService;
import ru.sibsutis.vrptw_backend.web.storage.InMemoryDataStore;

@Component
public class EventProcessor {

    private static final Set<String> TYPES = Set.of("NEW_ORDER", "ORDER_CANCELLED", "VISIT_DELAYED",
            "ORDER_TRANSFERRED", "STAFF_UNAVAILABLE", "TIME_TICK");
    private static final Set<String> TRANSFER_TARGETS = Set.of("STATION_EQUIPMENT", "TRUNK_CABLE");

    private final InMemoryDataStore store;
    private final PlanningService planning;
    private final tools.jackson.databind.json.JsonMapper mapper;

    public EventProcessor(InMemoryDataStore store, PlanningService planning,
                          tools.jackson.databind.json.JsonMapper mapper) {
        this.store = store;
        this.planning = planning;
        this.mapper = mapper;
    }

    public EventResult process(LocalDate date, Map<String, Object> e) {
        long t0 = System.nanoTime();
        String id = text(e, "event_id"), type = text(e, "type");
        OffsetDateTime ts = OffsetDateTime.parse(text(e, "timestamp"));
        if (!TYPES.contains(type)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Неизвестный тип события: " + type);
        if (store.findDay(date).isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "День не загружен");
        if (store.findReference().isEmpty() || store.findTravelMatrix().isEmpty())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Справочники/матрица не загружены");
        store.lastEventTimestamp(date).ifPresent(last -> {
            if (ts.isBefore(last)) throw new ResponseStatusException(HttpStatus.CONFLICT, "События должны идти в порядке неубывания timestamp");
        });
        validateRefs(date, type, e);
        validateStartedVisit(date, type, e, ts);

        boolean fresh = store.addEventIfAbsent(date, id, e);
        if (!fresh) {
            return new EventResult(id, true, true, store.currentVersion(date), ts,
                    (System.nanoTime() - t0) / 1_000_000, List.of(), List.of(), "Duplicate event; ignored");
        }

        apply(date, type, e, ts);
        // префикс строится по предыдущему плану, но с учётом end из VISIT_DELAYED/ORDER_TRANSFERRED
        Map<String, List<Stop>> prefix = completedPrefix(date, ts);
        store.setNow(date, ts);
        Plan plan = planning.replan(date, ts, id, prefix);
        return new EventResult(id, true, false, plan.planVersion(), ts,
                (System.nanoTime() - t0) / 1_000_000, changedStaff(prefix, plan), List.of(), "Event applied; plan replanned");
    }

    private void validateRefs(LocalDate date, String type, Map<String, Object> e) {
        String orderId = (String) e.get("order_id");
        String staffId = (String) e.get("staff_id");
        if (orderId != null && !knownOrder(date, orderId))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Неизвестный наряд: " + orderId);
        if (staffId != null && !knownStaff(staffId))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Неизвестный сотрудник: " + staffId);
    }
    /**
     * VISIT_DELAYED и ORDER_TRANSFERRED приходят только по уже начатому визиту
     * (спека: `start ≤ timestamp`), иначе событие противоречит состоянию плана — 422.
     */
    private void validateStartedVisit(LocalDate date, String type, Map<String, Object> e, OffsetDateTime ts) {
        if (!"VISIT_DELAYED".equals(type) && !"ORDER_TRANSFERRED".equals(type)) return;
        String orderId = text(e, "order_id");
        String staffId = text(e, "staff_id");
        Stop stop = null;
        String plannedStaff = null;
        Plan plan = store.findPlan(date).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "План ещё не построен"));
        for (var route : plan.routes()) {
            for (Stop s : route.stops()) {
                if ("VISIT".equals(s.type()) && orderId.equals(s.orderId())) {
                    stop = s;
                    plannedStaff = route.staffId();
                }
            }
        }
        if (stop == null) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Наряд не в маршруте: " + orderId);
        if (stop.start() == null || !stop.start().isBefore(ts)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Визит ещё не начат: " + orderId);
        if (!staffId.equals(plannedStaff)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Сотрудник " + staffId + " не исполняет наряд " + orderId);

        OffsetDateTime newEnd = OffsetDateTime.parse(text(e,
                "ORDER_TRANSFERRED".equals(type) ? "actual_end" : "expected_end"));
        if (!newEnd.isAfter(stop.start())) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Конец визита должен быть позже его начала");
        if ("VISIT_DELAYED".equals(type) && !newEnd.isAfter(stop.end())) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "expected_end должен быть позже планового окончания");
        if ("ORDER_TRANSFERRED".equals(type) && !TRANSFER_TARGETS.contains(text(e, "transferred_to")))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Неизвестное transferred_to: " + e.get("transferred_to"));
    }

    private boolean knownOrder(LocalDate d, String id) {
        return store.findDay(d).map(day -> day.orders() != null && day.orders().stream().anyMatch(o -> o.orderId().equals(id))).orElse(false)
                || store.extraOrders(d).stream().anyMatch(o -> o.orderId().equals(id));
    }
    private boolean knownStaff(String id) {
        return store.findReference().map(r -> r.staff() != null && r.staff().stream().anyMatch(s -> s.staffId().equals(id))).orElse(false);
    }

    private void apply(LocalDate date, String type, Map<String, Object> e, OffsetDateTime ts) {
        switch (type) {
            case "ORDER_CANCELLED" -> { store.removeOrder(date, (String) e.get("order_id"));
                store.addCancelled(date, new CancelledOrder((String) e.get("order_id"), ts, (String) e.get("event_id"))); }
            // Начатый визит остаётся в плане (заморозка H10), меняется только его end (H5).
            case "ORDER_TRANSFERRED" -> store.setVisitEnd(date, (String) e.get("order_id"),
                    OffsetDateTime.parse(text(e, "actual_end")));
            case "VISIT_DELAYED" -> store.setVisitEnd(date, (String) e.get("order_id"),
                    OffsetDateTime.parse(text(e, "expected_end")));
            case "STAFF_UNAVAILABLE" -> store.markUnavailable(date, (String) e.get("staff_id"));
            case "NEW_ORDER" -> {
                Object raw = e.get("order");
                if (raw == null) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "NEW_ORDER без поля order");
                store.addOrder(date, mapper.convertValue(raw, Order.class));
            }
            default -> { /* VISIT_DELAYED / TIME_TICK: пересборка из состояния */ }
        }
    }

    private Map<String, List<Stop>> completedPrefix(LocalDate date, OffsetDateTime ts) {
        Map<String, List<Stop>> prefix = new LinkedHashMap<>();
        store.findPlan(date).ifPresent(plan -> {
            for (var r : plan.routes()) {
                List<Stop> pre = new ArrayList<>();
                for (Stop s : r.stops()) {
                    if ("DEPOT_START".equals(s.type())) { pre.add(s); continue; }
                    if ("VISIT".equals(s.type()) && s.start() != null && s.start().isBefore(ts)) {
                        pre.add(withAdjustedEnd(date, s));
                        continue;
                    }
                    if ("BREAK".equals(s.type()) && s.end() != null && s.end().isBefore(ts)) { pre.add(s); continue; }
                    break;
                }
                if (!pre.isEmpty()) prefix.put(r.staffId(), pre);
            }
        });
        return prefix;
    }

    /** H5: end уже начатого визита берётся из VISIT_DELAYED / ORDER_TRANSFERRED. */
    private Stop withAdjustedEnd(LocalDate date, Stop s) {
        return store.visitEnd(date, s.orderId())
                .map(end -> new Stop(s.seq(), s.type(), s.locationId(), s.orderId(), s.arrival(), s.start(), end,
                        s.travelSec(), s.distanceM(), s.status(), s.equipmentAfter(), s.explanation()))
                .orElse(s);
    }

    private List<String> changedStaff(Map<String, List<Stop>> prefix, Plan plan) {
        List<String> ids = new ArrayList<>();
        for (var r : plan.routes()) if (prefix.containsKey(r.staffId()) || !r.stops().isEmpty()) ids.add(r.staffId());
        return ids;
    }

    private static String text(Map<String, Object> e, String f) {
        Object v = e.get(f);
        if (!(v instanceof String s) || s.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing required field: " + f);
        return s;
    }
}