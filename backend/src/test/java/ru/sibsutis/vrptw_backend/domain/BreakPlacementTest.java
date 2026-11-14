package ru.sibsutis.vrptw_backend.domain;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import ru.sibsutis.vrptw_backend.domain.constraint.DispatchConstraintProvider;
import ru.sibsutis.vrptw_backend.domain.enums.BuildingType;
import ru.sibsutis.vrptw_backend.domain.enums.Profile;
import ru.sibsutis.vrptw_backend.domain.enums.Technology;
import ru.sibsutis.vrptw_backend.domain.enums.WorkTypeCode;
import ru.sibsutis.vrptw_backend.domain.model.DaySolution;
import ru.sibsutis.vrptw_backend.domain.model.Equipment;
import ru.sibsutis.vrptw_backend.domain.model.Order;
import ru.sibsutis.vrptw_backend.domain.model.ServiceCenter;
import ru.sibsutis.vrptw_backend.domain.model.Shift;
import ru.sibsutis.vrptw_backend.domain.model.Staff;
import ru.sibsutis.vrptw_backend.domain.model.TravelMatrix;
import ru.sibsutis.vrptw_backend.domain.model.Visit;
import ru.sibsutis.vrptw_backend.domain.model.WorkType;

import ai.timefold.solver.core.api.solver.Solver;
import ai.timefold.solver.core.api.solver.SolverFactory;
import ai.timefold.solver.core.config.solver.SolverConfig;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BreakPlacementTest {

    private static final OffsetDateTime NOW = OffsetDateTime.of(2026, 10, 26, 8, 30, 0, 0, ZoneOffset.ofHours(5));

    @Test
    void breakIsTakenBeforeVisitWhenItEndsAfterTheWindow() {
        WorkType workType = new WorkType(WorkTypeCode.INST_PRIVATE_VLS, "Инсталляция ВЛС",
                Set.of(Profile.INSTALL), 180, 10, false);

        Order order = Order.builder()
                .orderId("ORD-20261026-0001")
                .workTypeCode(WorkTypeCode.INST_PRIVATE_VLS)
                .technology(Technology.PON)
                .buildingId("B-00001")
                .address("ул. Тестовая, 1")
                .buildingType(BuildingType.MKD)
                .requiresHeight(false)
                .accessNodeId("AN-0001")
                .registeredAt(NOW.minusDays(1))
                .slotStart(NOW.with(LocalTime.of(13, 0)))
                .slotEnd(NOW.with(LocalTime.of(15, 0)))
                .latestStart(NOW.with(LocalTime.of(15, 0)))
                .deadline(NOW.with(LocalTime.of(18, 0)))
                .requiredEquipment(Equipment.ZERO)
                .isRepeat(false)
                .build();

        List<String> points = new ArrayList<>(List.of("SC-01", "B-00001"));
        int[][] durations = {{0, 600}, {600, 0}};
        int[][] distances = {{0, 4000}, {4000, 0}};
        TravelMatrix matrix = new TravelMatrix("test", points, durations, distances);

        Shift shift = new Shift(LocalTime.of(9, 0), LocalTime.of(18, 0), 60,
                LocalTime.of(12, 0), LocalTime.of(15, 0));
        Staff staff = new Staff("ST-001", "SC-01", Set.of(Profile.INSTALL),
                new LinkedHashSet<>(List.of(Technology.PON)), true, shift,
                Equipment.of(2, 2, 2), Equipment.of(6, 6, 6));
        staff.setTravelMatrix(matrix);

        Visit visit = new Visit(order, workType);
        DaySolution problem = new DaySolution(LocalDate.of(2026, 10, 26), NOW,
                new ArrayList<>(List.of(visit)), new ArrayList<>(List.of(staff)),
                List.of(workType),
                List.of(new ServiceCenter("SC-01", "СЦ", "адрес", 56.8, 60.6,
                        LocalTime.of(8, 0), LocalTime.of(21, 0), 15)),
                matrix);

        SolverConfig config = new SolverConfig()
                .withSolutionClass(DaySolution.class)
                .withEntityClasses(Staff.class, Visit.class)
                .withConstraintProviderClass(DispatchConstraintProvider.class)
                .withTerminationSpentLimit(Duration.ofSeconds(3));
        Solver<DaySolution> solver = SolverFactory.<DaySolution>create(config).buildSolver();
        DaySolution solution = solver.solve(problem);

        assertNotNull(solution.getScore());
        assertTrue(solution.getScore().isFeasible(), "Ожидался допустимый план, получен " + solution.getScore());
        Visit solved = solution.getVisits().get(0);
        assertEquals(LocalTime.of(12, 0), solved.getTimings().breakStart().toLocalTime());
        assertEquals("SC-01", solved.getTimings().breakLocationId());
    }
}
