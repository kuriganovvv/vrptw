package ru.sibsutis.vrptw_backend.dto.day;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DayInput(
        LocalDate date,
        OffsetDateTime now,
        List<Order> orders,
        @JsonProperty("absent_staff_ids") List<String> absentStaffIds) {
}
