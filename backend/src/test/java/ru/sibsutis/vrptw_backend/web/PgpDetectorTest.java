package ru.sibsutis.vrptw_backend.web;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.web.pgp.PgpDetector;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class PgpDetectorTest {

    @Autowired PgpDetector detector;
    @Autowired JsonMapper mapper;

    @Test
    void groupsWithinSixtyMinutesAndSkipsStarted() throws Exception {
        ReferenceData ref = mapper.readValue(getClass().getResourceAsStream("/fixtures/reference-one-staff.json"), ReferenceData.class);
        DayInput day = mapper.readValue(getClass().getResourceAsStream("/fixtures/day-five-orders.json"), DayInput.class);
        OffsetDateTime at = OffsetDateTime.of(2026, 10, 26, 8, 30, 0, 0, ZoneOffset.ofHours(5));

        PgpDetector.Result all = detector.detect(day, ref, at, Set.of());
        PgpDetector.Result skip = detector.detect(day, ref, at, Set.of(day.orders().get(0).orderId()));
        assertThat(skip.groups().stream().mapToInt(g -> g.orderIds().size()).sum())
                .isLessThanOrEqualTo(all.groups().stream().mapToInt(g -> g.orderIds().size()).sum());
        assertThat(all.groups()).allSatisfy(g -> assertThat(g.detectedAt()).isEqualTo(at));
    }
}