package ru.sibsutis.vrptw_backend.dto.plan;

import ru.sibsutis.vrptw_backend.dto.day.TimeWindow;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Alert(
        @JsonProperty("alert_id") String alertId,
        @JsonProperty("created_at") OffsetDateTime createdAt,
        String type,
        String status,
        @JsonProperty("resolved_at") OffsetDateTime resolvedAt,
        @JsonProperty("order_id") String orderId,
        @JsonProperty("group_id") String groupId,
        @JsonProperty("staff_id") String staffId,
        @JsonProperty("forecast_start") OffsetDateTime forecastStart,
        @JsonProperty("lateness_min") Integer latenessMin,
        @JsonProperty("suggested_action") String suggestedAction,
        @JsonProperty("suggested_staff_id") String suggestedStaffId,
        @JsonProperty("proposed_slot") TimeWindow proposedSlot,
        boolean applied,
        String message) {
}
