package ru.sibsutis.vrptw_backend.web;

import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "timefold.solver.termination.spent-limit=2s")
@AutoConfigureMockMvc
class PgpFlowTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JsonMapper mapper;

    @Test
    void groupsRepairsFromOneNodeAndExcludesThemFromPlan() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);

        MvcResult result = mvc.perform(post("/api/v1/days/2026-10-26/plan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.orders_total").value(5))
                .andExpect(jsonPath("$.summary.pgp_orders").value(3))
                .andExpect(jsonPath("$.pgp_groups.length()").value(1))
                .andExpect(jsonPath("$.pgp_groups[0].access_node_id").value("AN-0001"))
                .andReturn();

        JsonNode plan = mapper.readTree(result.getResponse().getContentAsString());


        Set<String> grouped = new HashSet<>();
        plan.get("pgp_groups").get(0).get("order_ids").forEach(id -> grouped.add(id.asText()));
        assertThat(grouped).containsExactlyInAnyOrder(
                "ORD-20261026-0001", "ORD-20261026-0002", "ORD-20261026-0003");


        Set<String> inRoutes = new HashSet<>();
        for (JsonNode route : plan.get("routes")) {
            for (JsonNode stop : route.get("stops")) {
                JsonNode orderId = stop.get("order_id");
                if (orderId != null && !orderId.isNull()) {
                    inRoutes.add(orderId.asText());
                }
            }
        }
        assertThat(inRoutes).doesNotContainAnyElementsOf(grouped);


        Set<String> accounted = new HashSet<>(inRoutes);
        plan.get("unassigned").forEach(u -> accounted.add(u.get("order_id").asText()));
        assertThat(accounted).containsExactlyInAnyOrder("ORD-20261026-0004", "ORD-20261026-0005");
    }
}