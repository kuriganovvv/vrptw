package ru.sibsutis.vrptw_backend.dto.reference;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OpeningHours(
        @JsonFormat(pattern = "HH:mm") LocalTime open,
        @JsonFormat(pattern = "HH:mm") LocalTime close) {
}
