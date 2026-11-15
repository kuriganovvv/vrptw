package ru.sibsutis.vrptw_backend.dto.scenario;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import ru.sibsutis.vrptw_backend.dto.common.Equipment;

/** Ответ на вопрос «какой запас АО нужен, чтобы не заезжать в СЦ». */
@JsonIgnoreProperties(ignoreUnknown = true)
public record EquipmentRecommendation(
        @JsonProperty("restock_stops") int restockStops,
        List<EquipmentAdvice> staff,
        @JsonProperty("total_additional_start") Equipment totalAdditionalStart,
        @JsonProperty("total_additional_capacity") Equipment totalAdditionalCapacity,
        String note) {
}
