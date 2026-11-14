package ru.sibsutis.vrptw_backend.dto.reference;

import ru.sibsutis.vrptw_backend.dto.common.HourlyFactor;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;


@JsonIgnoreProperties(ignoreUnknown = true)
public record TravelMatrix(
        @JsonProperty("matrix_id") String matrixId,
        List<String> points,
        @JsonProperty("durations_sec") int[][] durationsSec,
        @JsonProperty("distances_m") int[][] distancesM,
        @JsonProperty("hourly_factors") List<HourlyFactor> hourlyFactors) {
}
