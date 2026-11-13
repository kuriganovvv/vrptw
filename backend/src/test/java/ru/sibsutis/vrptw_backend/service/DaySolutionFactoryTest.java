package ru.sibsutis.vrptw_backend.service;

import java.io.InputStream;
import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import ru.sibsutis.vrptw_backend.domain.model.DaySolution;
import ru.sibsutis.vrptw_backend.domain.constraint.DispatchConstraintProvider;
import ru.sibsutis.vrptw_backend.domain.model.Staff;
import ru.sibsutis.vrptw_backend.domain.model.Visit;
import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;

import ai.timefold.solver.core.api.solver.Solver;
import ai.timefold.solver.core.api.solver.SolverFactory;
import ai.timefold.solver.core.config.solver.SolverConfig;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DaySolutionFactoryTest {

    private final JsonMapper mapper = JsonMapper.builder()
            .disable(tools.jackson.databind.cfg.DateTimeFeature.ADJUST_DATES_TO_CONTEXT_TIME_ZONE)
            .build();

    @Test
    void buildsAndSolvesDayFromApiFixtures() throws Exception {
        ReferenceData reference = read("fixtures/reference-one-staff.json", ReferenceData.class);
        DayInput day = read("fixtures/day-five-orders.json", DayInput.class);

        List<String> points = new ArrayList<>(List.of("SC-01",
                "B-00001", "B-00002", "B-00003", "B-00004", "B-00005"));
        int n = points.size();
        int[][] durations = new int[n][n];
        int[][] distances = new int[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                if (i == j) {
                    continue;
                }
                boolean depot = i == 0 || j == 0;
                durations[i][j] = depot ? 600 : 300;
                distances[i][j] = depot ? 4000 : 1500;
            }
        }
        var matrix = new ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix("test", points, durations, distances, List.of());

        DaySolution problem = new DaySolutionFactory().build(reference, day, matrix);

        assertEquals(1, problem.getStaff().size());
        assertEquals(5, problem.getVisits().size());
        assertEquals(LocalTime.of(9, 0), problem.getStaff().get(0).getShift().start());

        SolverConfig config = new SolverConfig()
                .withSolutionClass(DaySolution.class)
                .withEntityClasses(Staff.class, Visit.class)
                .withConstraintProviderClass(DispatchConstraintProvider.class)
                .withTerminationSpentLimit(Duration.ofSeconds(5));
        Solver<DaySolution> solver = SolverFactory.<DaySolution>create(config).buildSolver();
        DaySolution solution = solver.solve(problem);

        assertNotNull(solution.getScore());
        assertTrue(solution.getScore().isFeasible(), "Ожидался допустимый план, получен " + solution.getScore());
        assertEquals(5, solution.getVisits().stream().filter(Visit::isAssigned).count());
    }

    private <T> T read(String resource, Class<T> type) throws Exception {
        try (InputStream stream = getClass().getClassLoader().getResourceAsStream(resource)) {
            assertNotNull(stream, "Не найден ресурс " + resource);
            return mapper.readValue(stream, type);
        }
    }
}
