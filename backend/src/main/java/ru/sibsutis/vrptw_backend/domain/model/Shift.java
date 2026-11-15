package ru.sibsutis.vrptw_backend.domain.model;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

public record Shift(
        LocalTime start,
        LocalTime end,
        int breakDurationMin,
        LocalTime breakWindowFrom,
        LocalTime breakWindowTo) {

    /**
     * Смена задана местным временем Екатеринбурга (UTC+5), а метки времени приходят
     * с произвольным смещением: спецификация организаторов допускает любое корректное
     * смещение, в том числе `Z`. Поэтому перед подстановкой местного времени момент
     * приводится к поясу сервиса.
     */
    private static final ZoneOffset SERVICE_OFFSET = ZoneOffset.ofHours(5);

    public static OffsetDateTime localAt(OffsetDateTime day, LocalTime time) {
        return day.withOffsetSameInstant(SERVICE_OFFSET).with(time);
    }

    public OffsetDateTime startAt(OffsetDateTime day) {
        return localAt(day, start);
    }

    public OffsetDateTime endAt(OffsetDateTime day) {
        return localAt(day, end);
    }

    public OffsetDateTime breakWindowFromAt(OffsetDateTime day) {
        return localAt(day, breakWindowFrom);
    }

    public OffsetDateTime breakWindowToAt(OffsetDateTime day) {
        return localAt(day, breakWindowTo);
    }
}
