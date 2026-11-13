package ru.sibsutis.vrptw_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AccessNode(
        @JsonProperty("access_node_id") String accessNodeId,
        @JsonProperty("node_type") String nodeType,
        String technology,
        String name,
        String address,
        double lat,
        double lon,
        List<Building> buildings) {
}
