package ru.sibsutis.vrptw_backend.dto.reference;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record WorkType(
        String code,
        String name,
        List<String> profiles,
        @JsonProperty("duration_min") int durationMin,
        @JsonProperty("max_start_delay_min") Integer maxStartDelayMin,
        @JsonProperty("deadline_kind") String deadlineKind,
        @JsonProperty("deadline_value") Integer deadlineValue,
        @JsonProperty("repeat_deadline_value") Integer repeatDeadlineValue,
        @JsonProperty("pgp_relevant") boolean pgpRelevant,
        Boolean joint) {
}
