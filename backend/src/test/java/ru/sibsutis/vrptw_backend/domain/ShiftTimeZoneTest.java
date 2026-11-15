package ru.sibsutis.vrptw_backend.domain;

import ru.sibsutis.vrptw_backend.domain.model.Shift;

import java.time.LocalTime;
import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ShiftTimeZoneTest {

    private static final Shift SHIFT = new Shift(LocalTime.of(9, 0), LocalTime.of(18, 0), 60,
            LocalTime.of(12, 0), LocalTime.of(15, 0));

    @Test
    void shiftTimesAreAnchoredToServiceOffset() {
        OffsetDateTime utcNow = OffsetDateTime.parse("2026-10-26T03:30:00Z");
        OffsetDateTime localNow = OffsetDateTime.parse("2026-10-26T08:30:00+05:00");

        assertEquals(OffsetDateTime.parse("2026-10-26T04:00:00Z").toInstant(),
                SHIFT.startAt(utcNow).toInstant());
        assertEquals(SHIFT.startAt(localNow).toInstant(), SHIFT.startAt(utcNow).toInstant());
        assertEquals(OffsetDateTime.parse("2026-10-26T13:00:00Z").toInstant(),
                SHIFT.endAt(utcNow).toInstant());
        assertEquals(OffsetDateTime.parse("2026-10-26T07:00:00Z").toInstant(),
                SHIFT.breakWindowFromAt(utcNow).toInstant());
        assertEquals(OffsetDateTime.parse("2026-10-26T10:00:00Z").toInstant(),
                SHIFT.breakWindowToAt(utcNow).toInstant());
    }
}
