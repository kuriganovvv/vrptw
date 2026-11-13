package ru.sibsutis.vrptw_backend.dto.reference;

import ru.sibsutis.vrptw_backend.dto.common.Equipment;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/** DTO схемы Staff. Строковые enum-поля намеренно оставлены строками: значения задаёт OpenAPI. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record Staff(
        @JsonProperty("staff_id") String staffId,
        @JsonProperty("display_name") String displayName,
        @JsonProperty("service_center_id") String serviceCenterId,
        List<String> profiles,
        List<String> technologies,
        @JsonProperty("height_permit") boolean heightPermit,
        Shift shift,
        @JsonProperty("equipment_start") Equipment equipmentStart,
        @JsonProperty("equipment_capacity") Equipment equipmentCapacity,
        @JsonProperty("experience_years") Double experienceYears) {
}
