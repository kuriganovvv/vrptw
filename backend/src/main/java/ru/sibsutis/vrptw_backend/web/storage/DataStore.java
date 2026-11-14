package ru.sibsutis.vrptw_backend.web.storage;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.day.Order;
import ru.sibsutis.vrptw_backend.dto.plan.Alert;
import ru.sibsutis.vrptw_backend.dto.plan.CancelledOrder;
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;

/**
 * Хранилище состояния сервиса. Реализации выбираются свойством
 * {@code vrptw.storage.mode}: {@code postgres} (по умолчанию) или {@code memory} (тесты).
 */
public interface DataStore {

    void saveReference(ReferenceData d);

    Optional<ReferenceData> findReference();

    /** Когда справочник последний раз сохранялся (нужно автозагрузке данных). */
    Optional<OffsetDateTime> referenceUpdatedAt();

    void saveTravelMatrix(TravelMatrix m);

    Optional<TravelMatrix> findTravelMatrix();

    /** Когда матрица последний раз сохранялась. */
    Optional<OffsetDateTime> travelMatrixUpdatedAt();

    void saveDay(LocalDate date, DayInput day);

    Optional<DayInput> findDay(LocalDate d);

    /** Когда наряды этой даты последний раз сохранялись. */
    Optional<OffsetDateTime> dayUpdatedAt(LocalDate d);

    /** Даты, загруженные в сервис (для UI-списка дней). */
    Set<LocalDate> loadedDates();

    void savePlan(LocalDate d, Plan p);

    Optional<Plan> findPlan(LocalDate d);

    boolean hasEvents(LocalDate d);

    int currentVersion(LocalDate d);

    int bumpVersion(LocalDate d);

    void setInitialVersion(LocalDate d);

    boolean addEventIfAbsent(LocalDate d, String id, Map<String, Object> e);

    List<Map<String, Object>> findEvents(LocalDate d);

    Optional<OffsetDateTime> lastEventTimestamp(LocalDate d);

    OffsetDateTime now(LocalDate d);

    void setNow(LocalDate d, OffsetDateTime t);

    List<CancelledOrder> cancelled(LocalDate d);

    void addCancelled(LocalDate d, CancelledOrder c);

    List<Alert> alerts(LocalDate d);

    void setAlerts(LocalDate d, List<Alert> a);

    void removeOrder(LocalDate d, String id);

    Set<String> removedOrders(LocalDate d);

    void addOrder(LocalDate d, Order o);

    List<Order> extraOrders(LocalDate d);

    void markUnavailable(LocalDate d, String staffId);

    Set<String> unavailableStaff(LocalDate d);

    /** Новый конец уже начатого визита из событий VISIT_DELAYED / ORDER_TRANSFERRED. */
    void setVisitEnd(LocalDate d, String orderId, OffsetDateTime end);

    Optional<OffsetDateTime> visitEnd(LocalDate d, String orderId);
}
