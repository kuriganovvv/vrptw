package ru.sibsutis.vrptw_backend.dto.reference;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Shift(
        @JsonFormat(pattern = "HH:mm") LocalTime start,
        @JsonFormat(pattern = "HH:mm") LocalTime end,
        @JsonProperty("break_duration_min") int breakDurationMin,
        @JsonProperty("break_window") BreakWindow breakWindow) {
}
