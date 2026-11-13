package ru.sibsutis.vrptw_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TravelMatrix(
        @JsonProperty("matrix_id") String matrixId,
        List<String> points,
        @JsonProperty("durations_sec") List<List<Integer>> durationsSec,
        @JsonProperty("distances_m") List<List<Integer>> distancesM,
        @JsonProperty("hourly_factors") List<HourlyFactor> hourlyFactors) {
}
