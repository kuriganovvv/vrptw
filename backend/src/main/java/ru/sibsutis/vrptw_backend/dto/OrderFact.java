package ru.sibsutis.vrptw_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OrderFact(
        String outcome,
        @JsonProperty("staff_id") String staffId,
        @JsonProperty("actual_start") OffsetDateTime actualStart,
        @JsonProperty("actual_duration_min") Integer actualDurationMin,
        @JsonProperty("pgp_incident_id") String pgpIncidentId) {
}
