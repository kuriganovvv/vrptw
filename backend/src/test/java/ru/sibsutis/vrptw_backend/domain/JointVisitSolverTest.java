package ru.sibsutis.vrptw_backend.domain;

import ru.sibsutis.vrptw_backend.domain.constraint.DispatchConstraintProvider;
import ru.sibsutis.vrptw_backend.domain.enums.*;
import ru.sibsutis.vrptw_backend.domain.model.*;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

import ai.timefold.solver.core.api.solver.Solver;
import ai.timefold.solver.core.api.solver.SolverFactory;
import ai.timefold.solver.core.config.solver.SolverConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JointVisitSolverTest {
    private static final OffsetDateTime NOW =
        OffsetDateTime.of(2026, 10, 26, 8, 30, 0, 0, ZoneOffset.ofHours(5));
    private static final LocalDate DATE = LocalDate.of(2026, 10, 26);

    @Test
    void jointVisitAssignedToTwoDifferentStaff() {
        WorkType vls = new WorkType(WorkTypeCode.INST_PRIVATE_VLS,
            "Инсталляция ВЛС", Set.of(Profile.INSTALL), 120, 10, false, true);

        List<String> points = new ArrayList<>(List.of("SC-01", "B-00001"));
        int n = points.size();
        int[][] durations = new int[n][n];
        int[][] distances = new int[n][n];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                if (i != j) { durations[i][j] = 600; distances[i][j] = 4000; }
        TravelMatrix matrix = new TravelMatrix("test", points, durations, distances);

        Shift shift = new Shift(LocalTime.of(9, 0), LocalTime.of(18, 0), 60,
            LocalTime.of(12, 0), LocalTime.of(15, 0));

        Staff staffA = new Staff("ST-001", "SC-01", Set.of(Profile.INSTALL),
            new LinkedHashSet<>(List.of(Technology.PON)), true, shift,
            Equipment.of(5, 5, 5), Equipment.of(6, 6, 6));
        staffA.setTravelMatrix(matrix);

        Staff staffB = new Staff("ST-002", "SC-01", Set.of(Profile.INSTALL),
            new LinkedHashSet<>(List.of(Technology.PON)), true, shift,
            Equipment.of(5, 5, 5), Equipment.of(6, 6, 6));
        staffB.setTravelMatrix(matrix);

        Order order = Order.builder()
            .orderId("ORD-JOINT-001")
            .workTypeCode(WorkTypeCode.INST_PRIVATE_VLS)
            .technology(Technology.PON)
            .buildingId("B-00001")
            .address("ул. Частная, 1")
            .buildingType(BuildingType.PRIVATE)
            .requiresHeight(true)
            .registeredAt(NOW.minusDays(1))
            .slotStart(NOW.with(LocalTime.of(10, 0)))
            .slotEnd(NOW.with(LocalTime.of(12, 0)))
            .latestStart(NOW.with(LocalTime.of(12, 0)))
            .deadline(NOW.with(LocalTime.of(17, 0)))
            .requiredEquipment(Equipment.of(1, 1, 0))
            .isRepeat(false)
            .build();

        Visit visitA = new Visit(order, vls);
        visitA.setVisitId("ORD-JOINT-001-A");
        visitA.setJointGroupId("ORD-JOINT-001");
        visitA.setPrimaryJoint(true);

        Visit visitB = new Visit(order, vls);
        visitB.setVisitId("ORD-JOINT-001-B");
        visitB.setJointGroupId("ORD-JOINT-001");
        visitB.setPrimaryJoint(false);

        DaySolution problem = new DaySolution(DATE, NOW,
            new ArrayList<>(List.of(visitA, visitB)),
            new ArrayList<>(List.of(staffA, staffB)),
            List.of(vls),
            List.of(new ServiceCenter("SC-01", "СЦ", "адрес", 56.8, 60.6,
                LocalTime.of(8, 0), LocalTime.of(21, 0), 15)),
            matrix);

        SolverConfig config = new SolverConfig()
            .withSolutionClass(DaySolution.class)
            .withEntityClasses(Staff.class, Visit.class)
            .withConstraintProviderClass(DispatchConstraintProvider.class)
            .withTerminationSpentLimit(Duration.ofSeconds(5));

        DaySolution solution = SolverFactory.<DaySolution>create(config)
            .buildSolver().solve(problem);
        assertNotNull(solution.getScore());
        assertTrue(solution.getScore().isFeasible(),
            "Ожидался допустимый план, получен " + solution.getScore());

        Visit solvedA = solution.getVisits().stream()
            .filter(v -> v.getVisitId().endsWith("-A"))
            .findFirst().orElseThrow();
        Visit solvedB = solution.getVisits().stream()
            .filter(v -> v.getVisitId().endsWith("-B"))
            .findFirst().orElseThrow();

        assertTrue(solvedA.isAssigned(), "Визит A должен быть назначен");
        assertTrue(solvedB.isAssigned(), "Визит B должен быть назначен");

        assertNotEquals(
            solvedA.getStaff().getStaffId(),
            solvedB.getStaff().getStaffId(),
            "Совместные визиты должны быть назначены разным сотрудникам");

        long gapMin = Math.abs(Duration.between(
            solvedA.getStart(), solvedB.getStart()).toMinutes());
        assertTrue(gapMin <= 5,
            "Разница во времени начала не должна превышать 5 мин, получено " + gapMin);
    }
}