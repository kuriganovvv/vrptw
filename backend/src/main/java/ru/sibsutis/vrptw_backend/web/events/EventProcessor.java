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

        boolean fresh = store.addEventIfAbsent(date, id, e);
        if (!fresh) {
            return new EventResult(id, true, true, store.currentVersion(date), ts,
                    (System.nanoTime() - t0) / 1_000_000, List.of(), List.of(), "Duplicate event; ignored");
        }

        Map<String, List<Stop>> prefix = completedPrefix(date, ts);
        apply(date, type, e, ts);
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
            case "ORDER_TRANSFERRED" -> store.removeOrder(date, (String) e.get("order_id"));
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
                    if ("VISIT".equals(s.type()) && s.start() != null && s.start().isBefore(ts)) { pre.add(s); continue; }
                    if ("BREAK".equals(s.type()) && s.end() != null && s.end().isBefore(ts)) { pre.add(s); continue; }
                    break;
                }
                if (!pre.isEmpty()) prefix.put(r.staffId(), pre);
            }
        });
        return prefix;
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