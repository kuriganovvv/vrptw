package ru.sibsutis.vrptw_backend.dto.scenario;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Метрики одного плана, по которым сравниваются сценарии. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ScenarioMetrics(
        @JsonProperty("staff_count") int staffCount,
        @JsonProperty("orders_total") int ordersTotal,
        @JsonProperty("visits_planned") int visitsPlanned,
        int unassigned,
        @JsonProperty("pgp_orders") int pgpOrders,
        @JsonProperty("slot_hits") int slotHits,
        @JsonProperty("deadline_hits") int deadlineHits,
        @JsonProperty("slot_hit_rate") double slotHitRate,
        @JsonProperty("deadline_hit_rate") double deadlineHitRate,
        @JsonProperty("travel_sec_total") long travelSecTotal,
        @JsonProperty("distance_m_total") long distanceMTotal,
        @JsonProperty("utilization_cv") double utilizationCv,
        @JsonProperty("restock_stops") int restockStops,
        @JsonProperty("restock_min") long restockMin) {
}
