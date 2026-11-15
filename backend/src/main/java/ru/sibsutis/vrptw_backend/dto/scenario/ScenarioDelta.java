package ru.sibsutis.vrptw_backend.dto.scenario;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Изменение метрик сценария относительно базового плана (сценарий − база). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ScenarioDelta(
        Integer assigned,
        Integer unassigned,
        @JsonProperty("slot_hits") Integer slotHits,
        @JsonProperty("deadline_hits") Integer deadlineHits,
        @JsonProperty("travel_sec_total") Long travelSecTotal,
        @JsonProperty("distance_m_total") Long distanceMTotal,
        @JsonProperty("utilization_cv") Double utilizationCv,
        @JsonProperty("restock_stops") Integer restockStops) {
}
