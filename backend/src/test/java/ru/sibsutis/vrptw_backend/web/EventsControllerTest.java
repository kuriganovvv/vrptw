package ru.sibsutis.vrptw_backend.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(EventsController.class)
class EventsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void acceptsAnEventAndReturnsTheRequiredFields() throws Exception {
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
}
