package ru.sibsutis.vrptw_backend.dto.scenario;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import ru.sibsutis.vrptw_backend.dto.common.Equipment;

/**
 * Рекомендация по «рюкзаку» одного сотрудника. Считается по маршруту базового
 * плана: стартовый запас должен покрывать суммарную потребность во всех визитах,
 * иначе понадобится заезд в СЦ.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record EquipmentAdvice(
        @JsonProperty("staff_id") String staffId,
        @JsonProperty("display_name") String displayName,
        int visits,
        @JsonProperty("restock_stops") int restockStops,
        @JsonProperty("current_start") Equipment currentStart,
        @JsonProperty("required_start") Equipment requiredStart,
        @JsonProperty("additional_start") Equipment additionalStart,
        @JsonProperty("current_capacity") Equipment currentCapacity,
        @JsonProperty("required_capacity") Equipment requiredCapacity,
        @JsonProperty("additional_capacity") Equipment additionalCapacity) {
}
