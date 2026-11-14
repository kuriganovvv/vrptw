package ru.sibsutis.vrptw_backend.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "timefold.solver.termination.spent-limit=2s")
@AutoConfigureMockMvc
class EventsApiTest {

    @Autowired MockMvc mvc;

    @Test
    void versionStaysOneBeforeEventsAndConflictAfter() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);
        mvc.perform(post("/api/v1/days/2026-10-26/plan")).andExpect(jsonPath("$.plan_version").value(1));
        mvc.perform(post("/api/v1/days/2026-10-26/plan")).andExpect(jsonPath("$.plan_version").value(1));

        mvc.perform(post("/api/v1/days/2026-10-26/events").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_id\":\"EV-1\",\"type\":\"TIME_TICK\",\"timestamp\":\"2026-10-26T11:15:00+05:00\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.plan_version").value(2));
        mvc.perform(post("/api/v1/days/2026-10-26/events").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_id\":\"EV-1\",\"type\":\"TIME_TICK\",\"timestamp\":\"2026-10-26T11:15:00+05:00\"}"))
                .andExpect(jsonPath("$.duplicate").value(true)).andExpect(jsonPath("$.plan_version").value(2));
        mvc.perform(post("/api/v1/days/2026-10-26/plan")).andExpect(status().isConflict());
    }

    @Test
    void outOfOrderAndUnknownRefsRejected() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);
        mvc.perform(post("/api/v1/days/2026-10-26/events").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_id\":\"EV-2\",\"type\":\"TIME_TICK\",\"timestamp\":\"2026-10-26T12:00:00+05:00\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/days/2026-10-26/events").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_id\":\"EV-3\",\"type\":\"TIME_TICK\",\"timestamp\":\"2026-10-26T11:00:00+05:00\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/days/2026-10-26/events").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_id\":\"EV-4\",\"type\":\"ORDER_CANCELLED\",\"timestamp\":\"2026-10-26T12:10:00+05:00\",\"order_id\":\"NOPE\"}"))
                .andExpect(status().isUnprocessableEntity());
    }
}