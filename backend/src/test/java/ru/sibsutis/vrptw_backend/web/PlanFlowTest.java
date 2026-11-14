package ru.sibsutis.vrptw_backend.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "timefold.solver.termination.spent-limit=2s",
        "dispatch.pgp.min-orders=100"
})
@AutoConfigureMockMvc
class PlanFlowTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void fullApiFlowProducesPlan() throws Exception {
        mvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        ApiTestSupport.loadReferenceMatrixAndDay(mvc);

        mvc.perform(post("/api/v1/days/2026-10-26/plan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan_version").value(1))
                .andExpect(jsonPath("$.routes[0].staff_id").value("ST-001"))
                .andExpect(jsonPath("$.summary.visits_planned").value(greaterThanOrEqualTo(4)))
                .andExpect(jsonPath("$.summary.pgp_orders").value(0));

        mvc.perform(get("/api/v1/days/2026-10-26/plan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.routes[0].stops.length()").value(greaterThanOrEqualTo(3)));
    }
}