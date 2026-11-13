package ru.sibsutis.vrptw_backend.dto.plan;

import ru.sibsutis.vrptw_backend.dto.common.Equipment;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Stop(
        int seq,
        String type,
        @JsonProperty("location_id") String locationId,
        @JsonProperty("order_id") String orderId,
        OffsetDateTime arrival,
        OffsetDateTime start,
        OffsetDateTime end,
        @JsonProperty("travel_sec") Long travelSec,
        @JsonProperty("distance_m") Long distanceM,
        String status,
        @JsonProperty("equipment_after") Equipment equipmentAfter,
        String explanation) {
}
