package ru.sibsutis.vrptw_backend.dto.reference;

import ru.sibsutis.vrptw_backend.dto.common.HourlyFactor;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Единая матрица времени в пути. Массивы, а не List&lt;List&lt;Integer&gt;&gt;:
 * матрица 1265×1265 — это 1,6 млн значений, боксовые Integer стоят десятки МБ.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TravelMatrix(
        @JsonProperty("matrix_id") String matrixId,
        List<String> points,
        @JsonProperty("durations_sec") int[][] durationsSec,
        @JsonProperty("distances_m") int[][] distancesM,
        @JsonProperty("hourly_factors") List<HourlyFactor> hourlyFactors) {
}
