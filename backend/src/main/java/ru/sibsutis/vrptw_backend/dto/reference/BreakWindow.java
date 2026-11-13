package ru.sibsutis.vrptw_backend.dto.reference;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BreakWindow(
        @JsonProperty("from") @JsonFormat(pattern = "HH:mm") LocalTime from,
        @JsonProperty("to") @JsonFormat(pattern = "HH:mm") LocalTime to) {
}
