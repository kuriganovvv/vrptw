package ru.sibsutis.vrptw_backend.web.storage;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.day.Order;
import ru.sibsutis.vrptw_backend.dto.plan.Alert;
import ru.sibsutis.vrptw_backend.dto.plan.CancelledOrder;
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;

/** Резервное in-memory хранилище: используется в тестах и при vrptw.storage.mode=memory. */
@Component
@ConditionalOnProperty(name = "vrptw.storage.mode", havingValue = "memory")
public class InMemoryDataStore implements DataStore {

    private final AtomicReference<ReferenceData> reference = new AtomicReference<>();
    private final AtomicReference<TravelMatrix> travelMatrix = new AtomicReference<>();
    private final ConcurrentMap<LocalDate, DayInput> days = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, Plan> plans = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, AtomicInteger> versions = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, List<Map<String, Object>>> events = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, OffsetDateTime> modelNow = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, List<CancelledOrder>> cancelled = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, List<Alert>> alerts = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, Set<String>> removedOrders = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, List<Order>> extraOrders = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, Set<String>> unavailableStaff = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, Map<String, OffsetDateTime>> visitEnds = new ConcurrentHashMap<>();

    public void saveReference(ReferenceData d) { reference.set(d); }
    public Optional<ReferenceData> findReference() { return Optional.ofNullable(reference.get()); }
    /** В памяти меток времени нет: автозагрузка не перезаписывает уже загруженные данные. */
    public Optional<OffsetDateTime> referenceUpdatedAt() { return Optional.empty(); }
    public void saveTravelMatrix(TravelMatrix m) { travelMatrix.set(m); }
    public Optional<TravelMatrix> findTravelMatrix() { return Optional.ofNullable(travelMatrix.get()); }
    public Optional<OffsetDateTime> travelMatrixUpdatedAt() { return Optional.empty(); }

    public void saveDay(LocalDate date, DayInput day) {
        days.put(date, day);
        plans.remove(date); versions.remove(date); events.remove(date);
        modelNow.remove(date); cancelled.remove(date); alerts.remove(date);
        removedOrders.remove(date); extraOrders.remove(date); unavailableStaff.remove(date);
        visitEnds.remove(date);
    }
    public Optional<DayInput> findDay(LocalDate d) { return Optional.ofNullable(days.get(d)); }
    public Optional<OffsetDateTime> dayUpdatedAt(LocalDate d) { return Optional.empty(); }
    /** Даты, загруженные в сервис (для UI-списка дней). */
    public Set<LocalDate> loadedDates() { return Set.copyOf(days.keySet()); }
    public void savePlan(LocalDate d, Plan p) { plans.put(d, p); }
    public Optional<Plan> findPlan(LocalDate d) { return Optional.ofNullable(plans.get(d)); }

    public boolean hasEvents(LocalDate d) { return !events.getOrDefault(d, List.of()).isEmpty(); }
    public int currentVersion(LocalDate d) { return versions.getOrDefault(d, new AtomicInteger()).get(); }
    public int bumpVersion(LocalDate d) { return versions.computeIfAbsent(d, k -> new AtomicInteger()).incrementAndGet(); }
    public void setInitialVersion(LocalDate d) { versions.put(d, new AtomicInteger(1)); }

    public boolean addEventIfAbsent(LocalDate d, String id, Map<String, Object> e) {
        List<Map<String, Object>> j = events.computeIfAbsent(d, k -> Collections.synchronizedList(new ArrayList<>()));
        synchronized (j) {
            for (Map<String, Object> x : j) if (id.equals(x.get("event_id"))) return false;
            j.add(Collections.unmodifiableMap(new LinkedHashMap<>(e)));
            return true;
        }
    }
    public List<Map<String, Object>> findEvents(LocalDate d) {
        List<Map<String, Object>> j = events.get(d);
        if (j == null) return List.of();
        synchronized (j) { return List.copyOf(j); }
    }
    public Optional<OffsetDateTime> lastEventTimestamp(LocalDate d) {
        List<Map<String, Object>> j = events.get(d);
        if (j == null || j.isEmpty()) return Optional.empty();
        synchronized (j) {
            return j.stream().map(e -> OffsetDateTime.parse((String) e.get("timestamp")))
                    .max(Comparator.naturalOrder());
        }
    }

    public OffsetDateTime now(LocalDate d) { return modelNow.getOrDefault(d, days.get(d).now()); }
    public void setNow(LocalDate d, OffsetDateTime t) { modelNow.put(d, t); }
    public List<CancelledOrder> cancelled(LocalDate d) { return cancelled.getOrDefault(d, List.of()); }
    public void addCancelled(LocalDate d, CancelledOrder c) { cancelled.computeIfAbsent(d, k -> new ArrayList<>()).add(c); }
    public List<Alert> alerts(LocalDate d) { return alerts.getOrDefault(d, List.of()); }
    public void setAlerts(LocalDate d, List<Alert> a) { alerts.put(d, a); }
    public void removeOrder(LocalDate d, String id) { removedOrders.computeIfAbsent(d, k -> new HashSet<>()).add(id); }
    public Set<String> removedOrders(LocalDate d) { return removedOrders.getOrDefault(d, Set.of()); }
    public void addOrder(LocalDate d, Order o) { extraOrders.computeIfAbsent(d, k -> new ArrayList<>()).add(o); }
    public List<Order> extraOrders(LocalDate d) { return extraOrders.getOrDefault(d, List.of()); }
    public void markUnavailable(LocalDate d, String staffId) { unavailableStaff.computeIfAbsent(d, k -> new HashSet<>()).add(staffId); }
    public Set<String> unavailableStaff(LocalDate d) { return unavailableStaff.getOrDefault(d, Set.of()); }

    /** Новый конец уже начатого визита из событий VISIT_DELAYED / ORDER_TRANSFERRED. */
    public void setVisitEnd(LocalDate d, String orderId, OffsetDateTime end) {
        visitEnds.computeIfAbsent(d, k -> new ConcurrentHashMap<>()).put(orderId, end);
    }
    public Optional<OffsetDateTime> visitEnd(LocalDate d, String orderId) {
        return Optional.ofNullable(visitEnds.getOrDefault(d, Map.of()).get(orderId));
    }
}