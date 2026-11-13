package ru.sibsutis.vrptw_backend.dto.plan;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Plan(
        LocalDate date,
        @JsonProperty("plan_version") int planVersion,
        @JsonProperty("based_on_event_id") String basedOnEventId,
        @JsonProperty("as_of") OffsetDateTime asOf,
        @JsonProperty("computation_ms") Long computationMs,
        List<Route> routes,
        List<UnassignedOrder> unassigned,
        @JsonProperty("pgp_groups") List<PgpGroup> pgpGroups,
        List<CancelledOrder> cancelled,
        List<Alert> alerts,
        PlanSummary summary) {
}
