package ru.sibsutis.vrptw_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record EventResult(
        @JsonProperty("event_id") String eventId,
        boolean accepted,
        boolean duplicate,
        @JsonProperty("plan_version") int planVersion,
        @JsonProperty("as_of") OffsetDateTime asOf,
        @JsonProperty("processing_ms") Long processingMs,
        @JsonProperty("changed_staff_ids") List<String> changedStaffIds,
        @JsonProperty("new_alerts") List<Map<String, Object>> newAlerts,
        String message) {
}
