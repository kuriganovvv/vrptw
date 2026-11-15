package ru.sibsutis.vrptw_backend.dto.scenario;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import ru.sibsutis.vrptw_backend.dto.common.Equipment;

/**
 * Параметры сценарного анализа. Все поля необязательны: пустой запрос
 * возвращает сравнение базового плана с ним же и рекомендации по запасу АО.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ScenarioRequest(
        // На сколько меньше сотрудников выйдет на смену (0 или отрицательное число).
        @JsonProperty("staff_delta") Integer staffDelta,
        // Явный список выбывающих сотрудников; имеет приоритет над staff_delta.
        @JsonProperty("excluded_staff_ids") List<String> excludedStaffIds,
        // Запас АО в рюкзаке на старте смены для всех сотрудников.
        @JsonProperty("equipment_start") Equipment equipmentStart,
        // Вместимость рюкзака для всех сотрудников.
        @JsonProperty("equipment_capacity") Equipment equipmentCapacity,
        // Подставить рекомендованный запас АО, рассчитанный по базовому плану.
        @JsonProperty("use_recommended_equipment") Boolean useRecommendedEquipment,
        // Лимит решения одного плана в секундах.
        @JsonProperty("time_limit_sec") Integer timeLimitSec) {

    public static ScenarioRequest empty() {
        return new ScenarioRequest(null, null, null, null, null, null);
    }
}
