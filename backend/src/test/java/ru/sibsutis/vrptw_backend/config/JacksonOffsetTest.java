package ru.sibsutis.vrptw_backend.config;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
class JacksonOffsetTest {

    @Autowired
    private JsonMapper mapper;

    @Test
    void keepsOffsetFromJson() {
        Sample sample = mapper.readValue("{\"at\":\"2026-10-26T09:00:00+05:00\"}", Sample.class);
        assertEquals(ZoneOffset.ofHours(5), sample.at().getOffset());
        assertEquals(9, sample.at().getHour());
    }

    record Sample(OffsetDateTime at) {
    }
}
