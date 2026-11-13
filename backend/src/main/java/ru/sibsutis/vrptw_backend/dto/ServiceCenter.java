package ru.sibsutis.vrptw_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ServiceCenter(
        @JsonProperty("service_center_id") String serviceCenterId,
        String name,
        String address,
        double lat,
        double lon,
        @JsonProperty("opening_hours") OpeningHours openingHours,
        @JsonProperty("restock_duration_min") int restockDurationMin) {
}
