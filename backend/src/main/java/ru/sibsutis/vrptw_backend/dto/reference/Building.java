package ru.sibsutis.vrptw_backend.dto.reference;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Building(
        @JsonProperty("building_id") String buildingId,
        String address,
        double lat,
        double lon,
        @JsonProperty("building_type") String buildingType,
        @JsonProperty("overhead_line") boolean overheadLine,
        @JsonProperty("zone_service_center_id") String zoneServiceCenterId) {
}
