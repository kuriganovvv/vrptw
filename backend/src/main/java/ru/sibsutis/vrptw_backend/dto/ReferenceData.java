package ru.sibsutis.vrptw_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ReferenceData(
        @JsonProperty("service_centers") List<ServiceCenter> serviceCenters,
        List<Staff> staff,
        @JsonProperty("access_nodes") List<AccessNode> accessNodes,
        @JsonProperty("work_types") List<WorkType> workTypes) {
}
