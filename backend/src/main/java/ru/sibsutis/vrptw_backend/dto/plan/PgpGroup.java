package ru.sibsutis.vrptw_backend.dto.plan;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PgpGroup(
        @JsonProperty("group_id") String groupId,
        @JsonProperty("access_node_id") String accessNodeId,
        @JsonProperty("order_ids") List<String> orderIds,
        @JsonProperty("detected_at") OffsetDateTime detectedAt,
        String action,
        String comment) {
}
