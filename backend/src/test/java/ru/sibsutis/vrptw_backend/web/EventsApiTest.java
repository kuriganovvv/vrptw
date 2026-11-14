package ru.sibsutis.vrptw_backend.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
    void newOrderIsAddedToTheDay() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);
        mvc.perform(post("/api/v1/days/2026-10-26/plan")).andExpect(status().isOk());

        mvc.perform(post("/api/v1/days/2026-10-26/events").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"event_id":"EV-NEW-1","type":"NEW_ORDER","timestamp":"2026-10-26T09:30:00+05:00",
                         "order":{"order_id":"ORD-20261026-0101","work_type_code":"REPAIR",
                          "technology":"PON","building_id":"B-00001","address":"ул. Тестовая, 1",
                          "lat":56.8712,"lon":60.6531,"building_type":"MKD","requires_height":false,
                          "access_node_id":"AN-0001","registered_at":"2026-10-26T09:30:00+05:00",
                          "slot":{"start":"2026-10-26T16:00:00+05:00","end":"2026-10-26T18:00:00+05:00"},
                          "latest_start":"2026-10-26T18:00:00+05:00","deadline":"2026-10-26T22:00:00+05:00",
                          "required_equipment":{"ONT":0,"ROUTER":1,"STB":0},"is_repeat":false}}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan_version").value(2));

        mvc.perform(get("/api/v1/days/2026-10-26/plan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.orders_total").value(6));
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