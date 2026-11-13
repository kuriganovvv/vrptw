package ru.sibsutis.vrptw_backend.dto.plan;

import ru.sibsutis.vrptw_backend.dto.day.TimeWindow;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UnassignedOrder(
        @JsonProperty("order_id") String orderId,
        @JsonProperty("reason_code") String reasonCode,
        @JsonProperty("reason_text") String reasonText,
        @JsonProperty("suggested_action") String suggestedAction,
        @JsonProperty("proposed_slot") TimeWindow proposedSlot,
        OffsetDateTime since) {
}
