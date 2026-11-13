package ru.sibsutis.vrptw_backend.dto.plan;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RouteTotals(
        Integer visits,
        @JsonProperty("travel_sec") Long travelSec,
        @JsonProperty("distance_m") Long distanceM,
        @JsonProperty("work_min") Integer workMin,
        Double utilization) {
}
