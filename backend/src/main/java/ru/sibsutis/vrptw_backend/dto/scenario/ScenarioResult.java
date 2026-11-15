package ru.sibsutis.vrptw_backend.dto.scenario;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.plan.UnassignedOrder;

/**
 * Результат сценарного анализа: базовый план, план сценария и их сравнение.
 * План сценария не сохраняется как рабочий план дня.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ScenarioResult(
        LocalDate date,
        @JsonProperty("as_of") OffsetDateTime asOf,
        @JsonProperty("computation_ms") long computationMs,
        @JsonProperty("time_limit_sec") int timeLimitSec,
        @JsonProperty("staff_delta") int staffDelta,
        @JsonProperty("excluded_staff_ids") List<String> excludedStaffIds,
        ScenarioMetrics baseline,
        ScenarioMetrics scenario,
        ScenarioDelta delta,
        @JsonProperty("newly_unassigned") List<UnassignedOrder> newlyUnassigned,
        @JsonProperty("equipment_recommendation") EquipmentRecommendation equipmentRecommendation,
        @JsonProperty("scenario_plan") Plan scenarioPlan) {
}
