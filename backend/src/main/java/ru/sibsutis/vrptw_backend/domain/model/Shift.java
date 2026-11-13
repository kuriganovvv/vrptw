package ru.sibsutis.vrptw_backend.domain.model;

import java.time.LocalTime;
import java.time.OffsetDateTime;

public record Shift(
        LocalTime start,
        LocalTime end,
        int breakDurationMin,
        LocalTime breakWindowFrom,
        LocalTime breakWindowTo) {

    public OffsetDateTime startAt(OffsetDateTime day) {
        return day.with(start);
    }

    public OffsetDateTime endAt(OffsetDateTime day) {
        return day.with(end);
    }

    public OffsetDateTime breakWindowFromAt(OffsetDateTime day) {
        return day.with(breakWindowFrom);
    }

    public OffsetDateTime breakWindowToAt(OffsetDateTime day) {
        return day.with(breakWindowTo);
    }
}
