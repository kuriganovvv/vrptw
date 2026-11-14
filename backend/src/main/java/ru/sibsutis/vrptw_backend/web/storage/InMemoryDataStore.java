package ru.sibsutis.vrptw_backend.web.storage;

import java.time.LocalDate;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.stereotype.Component;

import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;

@Component
public class InMemoryDataStore {

    private final AtomicReference<ReferenceData> reference = new AtomicReference<>();
    private final AtomicReference<TravelMatrix> travelMatrix = new AtomicReference<>();
    private final ConcurrentMap<LocalDate, DayInput> days = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, Plan> plans = new ConcurrentHashMap<>();
    private final ConcurrentMap<LocalDate, AtomicInteger> versions = new ConcurrentHashMap<>();

    public void saveReference(ReferenceData data) { reference.set(data); }
    public Optional<ReferenceData> findReference() { return Optional.ofNullable(reference.get()); }

    public void saveTravelMatrix(TravelMatrix matrix) { travelMatrix.set(matrix); }
    public Optional<TravelMatrix> findTravelMatrix() { return Optional.ofNullable(travelMatrix.get()); }

    public void saveDay(LocalDate date, DayInput day) {
        days.put(date, day);
        plans.remove(date);      // новая загрузка нарядов инвалидирует старый план
        versions.remove(date);
    }
    public Optional<DayInput> findDay(LocalDate date) { return Optional.ofNullable(days.get(date)); }

    public void savePlan(LocalDate date, Plan plan) { plans.put(date, plan); }
    public Optional<Plan> findPlan(LocalDate date) { return Optional.ofNullable(plans.get(date)); }

    public int nextPlanVersion(LocalDate date) {
        return versions.computeIfAbsent(date, d -> new AtomicInteger()).incrementAndGet();
    }
}