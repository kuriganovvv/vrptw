package ru.sibsutis.vrptw_backend.dto.plan;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanSummary(
        @JsonProperty("orders_total") Integer ordersTotal,
        @JsonProperty("visits_planned") Integer visitsPlanned,
        Integer unassigned,
        @JsonProperty("pgp_orders") Integer pgpOrders,
        Integer cancelled,
        @JsonProperty("travel_sec_total") Long travelSecTotal,
        @JsonProperty("utilization_cv") Double utilizationCv) {
}
