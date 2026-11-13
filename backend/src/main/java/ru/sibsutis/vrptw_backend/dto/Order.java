package ru.sibsutis.vrptw_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Order(
        @JsonProperty("order_id") String orderId,
        @JsonProperty("work_type_code") String workTypeCode,
        String technology,
        @JsonProperty("building_id") String buildingId,
        String address,
        double lat,
        double lon,
        @JsonProperty("building_type") String buildingType,
        @JsonProperty("requires_height") boolean requiresHeight,
        @JsonProperty("access_node_id") String accessNodeId,
        @JsonProperty("registered_at") OffsetDateTime registeredAt,
        TimeWindow slot,
        @JsonProperty("latest_start") OffsetDateTime latestStart,
        OffsetDateTime deadline,
        @JsonProperty("required_equipment") Equipment requiredEquipment,
        @JsonProperty("is_repeat") boolean isRepeat,
        @JsonProperty("previous_order_id") String previousOrderId,
        OrderFact fact) {
}
