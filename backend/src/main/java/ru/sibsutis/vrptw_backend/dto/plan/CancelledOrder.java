package ru.sibsutis.vrptw_backend.dto.plan;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CancelledOrder(
        @JsonProperty("order_id") String orderId,
        @JsonProperty("cancelled_at") OffsetDateTime cancelledAt,
        @JsonProperty("event_id") String eventId) {
}
