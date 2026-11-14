package ru.sibsutis.vrptw_backend.web;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** VISIT_DELAYED и ORDER_TRANSFERRED: начатый визит заморожен, меняется только его end (H5/H10). */
@SpringBootTest(properties = "timefold.solver.termination.spent-limit=2s")
@AutoConfigureMockMvc
class EventAdjustmentsTest {

    private static final String DAY = "/api/v1/days/2026-10-26";

    @Autowired MockMvc mvc;

    @Test
    void visitDelayedMovesEndAndPushesTheRestOfTheRoute() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);
        mvc.perform(post(DAY + "/plan")).andExpect(status().isOk());

        List<Map<String, Object>> stops = planStops();
        Map<String, Object> visit = earliestVisit(stops);
        String orderId = (String) visit.get("order_id");
        OffsetDateTime start = time(visit.get("start"));
        OffsetDateTime plannedEnd = time(visit.get("end"));
        OffsetDateTime expectedEnd = plannedEnd.plusMinutes(30);

        mvc.perform(post(DAY + "/events").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_id\":\"EV-DELAY-1\",\"type\":\"VISIT_DELAYED\",\"timestamp\":\""
                        + start.plusMinutes(10) + "\",\"staff_id\":\"ST-001\",\"order_id\":\"" + orderId
                        + "\",\"expected_end\":\"" + expectedEnd + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan_version").value(2));

        String body = currentPlan();
        assertThat(time(stopById(body, orderId).get("end"))).isEqualTo(expectedEnd);
        assertThat(time(stopById(body, orderId).get("start"))).isEqualTo(start);

        Map<String, Object> next = nextStop(body, orderId);
        OffsetDateTime nextArrival = time(next.get("arrival"));
        long travelSec = next.get("travel_sec") == null ? 0 : ((Number) next.get("travel_sec")).longValue();
        assertThat(nextArrival).isAfterOrEqualTo(expectedEnd.plusSeconds(travelSec));
    }

    @Test
    void orderTransferredEndsVisitEarlierAndFreesTheStaff() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);
        mvc.perform(post(DAY + "/plan")).andExpect(status().isOk());

        List<Map<String, Object>> stops = planStops();
        Map<String, Object> visit = earliestVisit(stops);
        String orderId = (String) visit.get("order_id");
        OffsetDateTime start = time(visit.get("start"));
        OffsetDateTime actualEnd = start.plusMinutes(15);

        mvc.perform(post(DAY + "/events").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_id\":\"EV-TRANSFER-1\",\"type\":\"ORDER_TRANSFERRED\",\"timestamp\":\""
                        + actualEnd + "\",\"staff_id\":\"ST-001\",\"order_id\":\"" + orderId
                        + "\",\"actual_end\":\"" + actualEnd + "\",\"transferred_to\":\"STATION_EQUIPMENT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan_version").value(2));

        String body = currentPlan();
        // H5: end начатого визита — момент из события, start и сотрудник не меняются
        assertThat(time(stopById(body, orderId).get("end"))).isEqualTo(actualEnd);
        assertThat(time(stopById(body, orderId).get("start"))).isEqualTo(start);
        // H9: обслуженный на месте наряд не уходит в unassigned
        List<String> unassigned = JsonPath.read(body, "$.unassigned[*].order_id");
        assertThat(unassigned).doesNotContain(orderId);
    }

    @Test
    void delayForNotStartedVisitIsRejected() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);
        mvc.perform(post(DAY + "/plan")).andExpect(status().isOk());

        Map<String, Object> latest = latestVisit(planStops());
        String orderId = (String) latest.get("order_id");
        OffsetDateTime start = time(latest.get("start"));

        mvc.perform(post(DAY + "/events").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_id\":\"EV-DELAY-2\",\"type\":\"VISIT_DELAYED\",\"timestamp\":\""
                        + start.minusMinutes(5) + "\",\"staff_id\":\"ST-001\",\"order_id\":\"" + orderId
                        + "\",\"expected_end\":\"" + start.plusMinutes(90) + "\"}"))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(get(DAY + "/plan")).andExpect(status().isOk()).andExpect(jsonPath("$.plan_version").value(1));
    }

    @Test
    void delayMustEndLaterThanPlanned() throws Exception {
        ApiTestSupport.loadReferenceMatrixAndDay(mvc);
        mvc.perform(post(DAY + "/plan")).andExpect(status().isOk());

        Map<String, Object> visit = earliestVisit(planStops());
        String orderId = (String) visit.get("order_id");
        OffsetDateTime start = time(visit.get("start"));

        mvc.perform(post(DAY + "/events").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event_id\":\"EV-DELAY-3\",\"type\":\"VISIT_DELAYED\",\"timestamp\":\""
                        + start.plusMinutes(5) + "\",\"staff_id\":\"ST-001\",\"order_id\":\"" + orderId
                        + "\",\"expected_end\":\"" + start.plusMinutes(30) + "\"}"))
                .andExpect(status().isUnprocessableEntity());
    }

    // ---------- helpers ----------

    private String currentPlan() throws Exception {
        return mvc.perform(get(DAY + "/plan")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> planStops() throws Exception {
        String body = mvc.perform(get(DAY + "/plan")).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.routes[0].stops");
    }

    /** Первый по времени визит маршрута — он точно начат к моменту timestamp. */
    private static Map<String, Object> earliestVisit(List<Map<String, Object>> stops) {
        Map<String, Object> best = null;
        for (Map<String, Object> s : stops) {
            if (!"VISIT".equals(s.get("type")) || s.get("start") == null) continue;
            if (best == null || time(best.get("start")).isAfter(time(s.get("start")))) best = s;
        }
        assertThat(best).isNotNull();
        return best;
    }

    private static Map<String, Object> latestVisit(List<Map<String, Object>> stops) {
        Map<String, Object> best = null;
        for (Map<String, Object> s : stops) {
            if (!"VISIT".equals(s.get("type")) || s.get("start") == null) continue;
            if (best == null || time(s.get("start")).isAfter(time(best.get("start")))) best = s;
        }
        assertThat(best).isNotNull();
        return best;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> stopById(String body, String orderId) {
        List<Map<String, Object>> stops = JsonPath.read(body, "$.routes[*].stops[*]");
        for (Map<String, Object> s : stops) {
            if (orderId.equals(s.get("order_id"))) return s;
        }
        throw new AssertionError("Остановка не найдена: " + orderId);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> nextStop(String body, String orderId) {
        List<List<Map<String, Object>>> routes = JsonPath.read(body, "$.routes[*].stops");
        List<Map<String, Object>> stops = new ArrayList<>();
        for (List<Map<String, Object>> route : routes) {
            for (int i = 0; i < route.size(); i++) {
                if (orderId.equals(route.get(i).get("order_id")) && i + 1 < route.size()) {
                    return route.get(i + 1);
                }
            }
        }
        throw new AssertionError("За остановкой не нашлось следующей: " + orderId);
    }

    private static OffsetDateTime time(Object value) {
        return OffsetDateTime.parse(String.valueOf(value));
    }
}
