package ru.sibsutis.vrptw_backend.dto.plan;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Route(
        @JsonProperty("staff_id") String staffId,
        @JsonProperty("service_center_id") String serviceCenterId,
        String status,
        @JsonProperty("unavailable_from") OffsetDateTime unavailableFrom,
        @JsonProperty("unavailable_until") OffsetDateTime unavailableUntil,
        List<Stop> stops,
        RouteTotals totals) {
}
