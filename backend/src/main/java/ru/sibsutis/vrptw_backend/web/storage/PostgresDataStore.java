package ru.sibsutis.vrptw_backend.web.storage;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.day.Order;
import ru.sibsutis.vrptw_backend.dto.plan.Alert;
import ru.sibsutis.vrptw_backend.dto.plan.CancelledOrder;
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;


@Repository
@ConditionalOnProperty(name = "vrptw.storage.mode", havingValue = "postgres", matchIfMissing = true)
public class PostgresDataStore implements DataStore {

    private static final String[] DAY_STATE_TABLES = {
            "plan",
            "day_version",
            "day_event",
            "day_model_now",
            "day_cancelled",
            "day_alert",
            "day_removed_order",
            "day_extra_order",
            "day_unavailable_staff",
            "day_visit_end"
    };

    private final JdbcTemplate jdbc;
    private final JsonMapper mapper;

    public PostgresDataStore(JdbcTemplate jdbc, JsonMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @PostConstruct
    void initializeSchema() {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(new ClassPathResource("schema.sql"));
        populator.execute(Objects.requireNonNull(jdbc.getDataSource()));
    }

    @Override
    public void saveReference(ReferenceData d) {
        jdbc.update("""
                INSERT INTO reference_data (id, payload) VALUES (1, ?::jsonb)
                ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
                """, json(d));
    }

    @Override
    public Optional<ReferenceData> findReference() {
        return first("SELECT payload FROM reference_data WHERE id = 1", ReferenceData.class);
    }

    @Override
    public void saveTravelMatrix(TravelMatrix m) {
        jdbc.update("""
                INSERT INTO travel_matrix (id, payload) VALUES (1, ?::jsonb)
                ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
                """, json(m));
    }

    @Override
    public Optional<TravelMatrix> findTravelMatrix() {
        return first("SELECT payload FROM travel_matrix WHERE id = 1", TravelMatrix.class);
    }

    @Override
    @Transactional
    public void saveDay(LocalDate date, DayInput day) {
        jdbc.update("""
                INSERT INTO day (date, payload) VALUES (?, ?::jsonb)
                ON CONFLICT (date) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
                """, date, json(day));
        for (String table : DAY_STATE_TABLES) {
            jdbc.update("DELETE FROM " + table + " WHERE date = ?", date);
        }
    }

    @Override
    public Optional<DayInput> findDay(LocalDate d) {
        return first("SELECT payload FROM day WHERE date = ?", DayInput.class, d);
    }

    @Override
    public Set<LocalDate> loadedDates() {
        return new LinkedHashSet<>(jdbc.query("SELECT date FROM day ORDER BY date",
                (rs, rowNum) -> rs.getObject("date", LocalDate.class)));
    }

    @Override
    public void savePlan(LocalDate d, Plan p) {
        jdbc.update("""
                INSERT INTO plan (date, payload) VALUES (?, ?::jsonb)
                ON CONFLICT (date) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
                """, d, json(p));
    }

    @Override
    public Optional<Plan> findPlan(LocalDate d) {
        return first("SELECT payload FROM plan WHERE date = ?", Plan.class, d);
    }

    @Override
    public boolean hasEvents(LocalDate d) {
        Boolean result = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM day_event WHERE date = ?)", Boolean.class, d);
        return Boolean.TRUE.equals(result);
    }

    @Override
    public int currentVersion(LocalDate d) {
        List<Integer> versions = jdbc.query("SELECT version FROM day_version WHERE date = ?",
                (rs, rowNum) -> rs.getInt("version"), d);
        return versions.isEmpty() ? 0 : versions.get(0);
    }

    @Override
    public int bumpVersion(LocalDate d) {
        Integer version = jdbc.queryForObject("""
                INSERT INTO day_version (date, version) VALUES (?, 1)
                ON CONFLICT (date) DO UPDATE SET version = day_version.version + 1
                RETURNING version
                """, Integer.class, d);
        return version == null ? 0 : version;
    }

    @Override
    public void setInitialVersion(LocalDate d) {
        jdbc.update("""
                INSERT INTO day_version (date, version) VALUES (?, 1)
                ON CONFLICT (date) DO UPDATE SET version = 1
                """, d);
    }

    @Override
    public boolean addEventIfAbsent(LocalDate d, String id, Map<String, Object> e) {
        int inserted = jdbc.update("""
                INSERT INTO day_event (date, event_id, payload) VALUES (?, ?, ?::jsonb)
                ON CONFLICT (date, event_id) DO NOTHING
                """, d, id, json(e));
        return inserted > 0;
    }

    @Override
    public List<Map<String, Object>> findEvents(LocalDate d) {
        return jdbc.query("SELECT payload FROM day_event WHERE date = ? ORDER BY id",
                (rs, rowNum) -> mapper.readValue(rs.getString("payload"), new TypeReference<Map<String, Object>>() {
                }), d);
    }

    @Override
    public Optional<OffsetDateTime> lastEventTimestamp(LocalDate d) {
        OffsetDateTime timestamp = jdbc.query(
                "SELECT max((payload->>'timestamp')::timestamptz) FROM day_event WHERE date = ?",
                rs -> rs.next() ? rs.getObject(1, OffsetDateTime.class) : null, d);
        return Optional.ofNullable(timestamp);
    }

    @Override
    public OffsetDateTime now(LocalDate d) {
        List<OffsetDateTime> values = jdbc.query("SELECT now_at FROM day_model_now WHERE date = ?",
                (rs, rowNum) -> rs.getObject("now_at", OffsetDateTime.class), d);
        if (!values.isEmpty()) {
            return values.get(0);
        }
        return findDay(d).map(DayInput::now).orElse(null);
    }

    @Override
    public void setNow(LocalDate d, OffsetDateTime t) {
        jdbc.update("""
                INSERT INTO day_model_now (date, now_at) VALUES (?, ?)
                ON CONFLICT (date) DO UPDATE SET now_at = EXCLUDED.now_at
                """, d, t);
    }

    @Override
    public List<CancelledOrder> cancelled(LocalDate d) {
        return jdbc.query("SELECT payload FROM day_cancelled WHERE date = ? ORDER BY id",
                (rs, rowNum) -> mapper.readValue(rs.getString("payload"), CancelledOrder.class), d);
    }

    @Override
    public void addCancelled(LocalDate d, CancelledOrder c) {
        jdbc.update("INSERT INTO day_cancelled (date, payload) VALUES (?, ?::jsonb)", d, json(c));
    }

    @Override
    public List<Alert> alerts(LocalDate d) {
        return jdbc.query("SELECT payload FROM day_alert WHERE date = ? ORDER BY position",
                (rs, rowNum) -> mapper.readValue(rs.getString("payload"), Alert.class), d);
    }

    @Override
    @Transactional
    public void setAlerts(LocalDate d, List<Alert> a) {
        jdbc.update("DELETE FROM day_alert WHERE date = ?", d);
        if (a == null || a.isEmpty()) {
            return;
        }
        List<Object[]> rows = new ArrayList<>(a.size());
        for (int i = 0; i < a.size(); i++) {
            rows.add(new Object[]{d, i, json(a.get(i))});
        }
        jdbc.batchUpdate("INSERT INTO day_alert (date, position, payload) VALUES (?, ?, ?::jsonb)", rows);
    }

    @Override
    public void removeOrder(LocalDate d, String id) {
        jdbc.update("""
                INSERT INTO day_removed_order (date, order_id) VALUES (?, ?)
                ON CONFLICT (date, order_id) DO NOTHING
                """, d, id);
    }

    @Override
    public Set<String> removedOrders(LocalDate d) {
        return new LinkedHashSet<>(jdbc.query("SELECT order_id FROM day_removed_order WHERE date = ?",
                (rs, rowNum) -> rs.getString("order_id"), d));
    }

    @Override
    public void addOrder(LocalDate d, Order o) {
        jdbc.update("INSERT INTO day_extra_order (date, payload) VALUES (?, ?::jsonb)", d, json(o));
    }

    @Override
    public List<Order> extraOrders(LocalDate d) {
        return jdbc.query("SELECT payload FROM day_extra_order WHERE date = ? ORDER BY id",
                (rs, rowNum) -> mapper.readValue(rs.getString("payload"), Order.class), d);
    }

    @Override
    public void markUnavailable(LocalDate d, String staffId) {
        jdbc.update("""
                INSERT INTO day_unavailable_staff (date, staff_id) VALUES (?, ?)
                ON CONFLICT (date, staff_id) DO NOTHING
                """, d, staffId);
    }

    @Override
    public Set<String> unavailableStaff(LocalDate d) {
        return new LinkedHashSet<>(jdbc.query("SELECT staff_id FROM day_unavailable_staff WHERE date = ?",
                (rs, rowNum) -> rs.getString("staff_id"), d));
    }

    @Override
    public void setVisitEnd(LocalDate d, String orderId, OffsetDateTime end) {
        jdbc.update("""
                INSERT INTO day_visit_end (date, order_id, end_at) VALUES (?, ?, ?)
                ON CONFLICT (date, order_id) DO UPDATE SET end_at = EXCLUDED.end_at
                """, d, orderId, end);
    }

    @Override
    public Optional<OffsetDateTime> visitEnd(LocalDate d, String orderId) {
        List<OffsetDateTime> values = jdbc.query(
                "SELECT end_at FROM day_visit_end WHERE date = ? AND order_id = ?",
                (rs, rowNum) -> rs.getObject("end_at", OffsetDateTime.class), d, orderId);
        return values.isEmpty() ? Optional.empty() : Optional.ofNullable(values.get(0));
    }

    private <T> Optional<T> first(String sql, Class<T> type, Object... args) {
        List<T> values = jdbc.query(sql,
                (rs, rowNum) -> mapper.readValue(rs.getString("payload"), type), args);
        return values.isEmpty() ? Optional.empty() : Optional.ofNullable(values.get(0));
    }

    private String json(Object value) {
        return mapper.writeValueAsString(value);
    }
}
