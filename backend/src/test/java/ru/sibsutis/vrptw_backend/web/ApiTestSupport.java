package ru.sibsutis.vrptw_backend.web;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.StringJoiner;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

final class ApiTestSupport {

    private ApiTestSupport() {
    }

    static String resource(String path) throws IOException {
        try (InputStream in = ApiTestSupport.class.getResourceAsStream("/" + path)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    static void loadReferenceMatrixAndDay(MockMvc mvc) throws Exception {
        mvc.perform(put("/api/v1/reference").contentType(MediaType.APPLICATION_JSON)
                .content(resource("fixtures/reference-one-staff.json")))
                .andExpect(status().isOk());
        mvc.perform(put("/api/v1/reference/travel-matrix").contentType(MediaType.APPLICATION_JSON)
                .content(matrixJson()))
                .andExpect(status().isOk());
        mvc.perform(put("/api/v1/days/2026-10-26").contentType(MediaType.APPLICATION_JSON)
                .content(resource("fixtures/day-five-orders.json")))
                .andExpect(status().isOk());
    }

    static String matrixJson() {
        String[] points = {"SC-01", "B-00001", "B-00002", "B-00003", "B-00004", "B-00005"};
        StringJoiner pts = new StringJoiner("\",\"", "[\"", "\"]");
        StringJoiner dur = new StringJoiner(",", "[", "]");
        StringJoiner dist = new StringJoiner(",", "[", "]");
        for (int i = 0; i < points.length; i++) {
            pts.add(points[i]);
            StringJoiner rowDur = new StringJoiner(",", "[", "]");
            StringJoiner rowDist = new StringJoiner(",", "[", "]");
            for (int j = 0; j < points.length; j++) {
                boolean depot = i == 0 || j == 0;
                rowDur.add(String.valueOf(i == j ? 0 : depot ? 600 : 300));
                rowDist.add(String.valueOf(i == j ? 0 : depot ? 4000 : 1500));
            }
            dur.add(rowDur.toString());
            dist.add(rowDist.toString());
        }
        return "{\"matrix_id\":\"test\",\"points\":" + pts
                + ",\"durations_sec\":" + dur + ",\"distances_m\":" + dist + ",\"hourly_factors\":[]}";
    }
}