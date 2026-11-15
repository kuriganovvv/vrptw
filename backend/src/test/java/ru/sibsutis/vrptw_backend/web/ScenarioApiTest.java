package ru.sibsutis.vrptw_backend.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "timefold.solver.termination.spent-limit=2s",
        "dispatch.pgp.min-orders=100",
        "dispatch.scenario.time-limit-sec=1",
        "dispatch.scenario.max-time-limit-sec=5"
})
@AutoConfigureMockMvc
class ScenarioApiTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void fewerStaffScenarioKeepsWorkingPlanAndExplainsLosses() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);

        mvc.perform(post("/api/v1/days/2026-10-26/plan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan_version").value(1));

        mvc.perform(post("/api/v1/days/2026-10-26/scenarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"staff_delta\":-1,\"time_limit_sec\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.staff_delta").value(-1))
                .andExpect(jsonPath("$.excluded_staff_ids.length()").value(1))
                .andExpect(jsonPath("$.baseline.staff_count").value(1))
                .andExpect(jsonPath("$.baseline.visits_planned").value(greaterThanOrEqualTo(4)))
                .andExpect(jsonPath("$.scenario.staff_count").value(0))
                .andExpect(jsonPath("$.scenario.visits_planned").value(0))
                .andExpect(jsonPath("$.scenario.unassigned").value(5))
                .andExpect(jsonPath("$.delta.unassigned").value(greaterThanOrEqualTo(4)))
                .andExpect(jsonPath("$.newly_unassigned.length()").value(greaterThanOrEqualTo(4)))
                .andExpect(jsonPath("$.equipment_recommendation.staff.length()").value(1))
                .andExpect(jsonPath("$.equipment_recommendation.staff[0].staff_id").value("ST-001"))
                .andExpect(jsonPath("$.equipment_recommendation.staff[0].required_start.ONT")
                        .value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.scenario_plan.routes").exists());

        // Сценарий не должен менять сохранённый рабочий план дня.
        mvc.perform(get("/api/v1/days/2026-10-26/plan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan_version").value(1))
                .andExpect(jsonPath("$.summary.visits_planned").value(greaterThanOrEqualTo(4)));
    }

    @Test
    void emptyScenarioComparesPlanWithItselfAndRecommendsEquipment() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);

        mvc.perform(post("/api/v1/days/2026-10-26/scenarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"time_limit_sec\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.excluded_staff_ids.length()").value(0))
                .andExpect(jsonPath("$.baseline.visits_planned").value(greaterThanOrEqualTo(4)))
                .andExpect(jsonPath("$.scenario.visits_planned").value(greaterThanOrEqualTo(4)))
                .andExpect(jsonPath("$.equipment_recommendation.staff.length()").value(1));
    }

    @Test
    void invalidScenarioRequestsAreRejected() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);

        mvc.perform(post("/api/v1/days/2026-10-26/scenarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"staff_delta\":3}"))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/v1/days/2026-10-26/scenarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"excluded_staff_ids\":[\"ST-404\"]}"))
                .andExpect(status().isUnprocessableEntity());
    }
}
