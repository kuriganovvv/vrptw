package ru.sibsutis.vrptw_backend.dto.day;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TimeWindow(OffsetDateTime start, OffsetDateTime end) {
}
