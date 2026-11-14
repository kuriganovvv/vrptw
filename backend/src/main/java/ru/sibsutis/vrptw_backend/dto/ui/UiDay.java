package ru.sibsutis.vrptw_backend.dto.ui;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UiDay(LocalDate date, OffsetDateTime now) {
}
