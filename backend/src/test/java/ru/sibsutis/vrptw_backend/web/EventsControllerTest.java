package ru.sibsutis.vrptw_backend.web;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import ru.sibsutis.vrptw_backend.dto.event.EventResult;
import ru.sibsutis.vrptw_backend.web.events.EventProcessor;

import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Слайс-тест контроллера: проверяем HTTP-контракт, логика — в EventsApiTest. */
@WebMvcTest(EventsController.class)
class EventsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EventProcessor processor;

    @Test
    void acceptsAnEventAndReturnsTheRequiredFields() throws Exception {
        when(processor.process(eq(LocalDate.of(2026, 10, 26)), anyMap()))
                .thenReturn(new EventResult("EV-20261026-0001", true, false, 1,
                        OffsetDateTime.parse("2026-10-26T11:15:00+05:00"),
                        0L, List.of(), List.of(), "Event applied"));

        mockMvc.perform(post("/api/v1/days/2026-10-26/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event_id":"EV-20261026-0001","type":"TIME_TICK",
                                 "timestamp":"2026-10-26T11:15:00+05:00"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event_id").value("EV-20261026-0001"))
                .andExpect(jsonPath("$.accepted").value(true))
                .andExpect(jsonPath("$.as_of").value("2026-10-26T11:15:00+05:00"));
    }

    @Test
    void marksRepeatedEventAsDuplicate() throws Exception {
        when(processor.process(eq(LocalDate.of(2026, 10, 26)), anyMap()))
                .thenReturn(new EventResult("EV-20261026-0001", true, true, 2,
                        OffsetDateTime.parse("2026-10-26T11:15:00+05:00"),
                        0L, List.of(), List.of(), "Duplicate event; ignored"));

        mockMvc.perform(post("/api/v1/days/2026-10-26/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event_id":"EV-20261026-0001","type":"TIME_TICK",
                                 "timestamp":"2026-10-26T11:15:00+05:00"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(true))
                .andExpect(jsonPath("$.duplicate").value(true));
    }
}