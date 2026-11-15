package ru.sibsutis.vrptw_backend.domain;

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
import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.plan.Stop;
import ru.sibsutis.vrptw_backend.web.plan.PlanAssembler;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import ai.timefold.solver.core.api.solver.Solver;
import ai.timefold.solver.core.api.solver.SolverFactory;
import ai.timefold.solver.core.config.solver.SolverConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RestockSolverTest {

    private static final OffsetDateTime NOW = OffsetDateTime.of(2026, 10, 26, 8, 30, 0, 0, ZoneOffset.ofHours(5));
    private static final LocalDate DATE = LocalDate.of(2026, 10, 26);

    @Test
    void restocksInsteadOfDroppingOrders() {
        WorkType repair = new WorkType(WorkTypeCode.REPAIR, "Устранение неисправности",
                Set.of(Profile.LTP3), 30, null, true);

        List<String> points = new ArrayList<>(List.of("SC-01"));
        List<Order> orders = new ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            String buildingId = String.format("B-%05d", i);
            points.add(buildingId);
            orders.add(Order.builder()
                    .orderId(String.format("ORD-20261026-%04d", i))
                    .workTypeCode(WorkTypeCode.REPAIR)
                    .technology(Technology.PON)
                    .buildingId(buildingId)
                    .address("ул. Тестовая, " + i)
                    .buildingType(BuildingType.MKD)
                    .requiresHeight(false)
                    .accessNodeId("AN-0001")
                    .registeredAt(NOW.minusDays(1))
                    .slotStart(NOW.with(LocalTime.of(8 + i, 0)))
                    .slotEnd(NOW.with(LocalTime.of(10 + i, 0)))
                    .latestStart(NOW.with(LocalTime.of(9 + i, 0)))
                    .deadline(NOW.with(LocalTime.of(18, 0)))
                    .requiredEquipment(Equipment.of(1, 0, 0))
                    .isRepeat(false)
                    .build());
        }

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
        TravelMatrix matrix = new TravelMatrix("test", points, durations, distances);

        Shift shift = new Shift(LocalTime.of(9, 0), LocalTime.of(18, 0), 60,
                LocalTime.of(12, 0), LocalTime.of(15, 0));
        // В рюкзаке один ONT, а нарядов три: без заезда в СЦ два наряда невыполнимы.
        Staff staff = new Staff("ST-001", "SC-01", Set.of(Profile.LTP3),
                new LinkedHashSet<>(List.of(Technology.PON)),
                true, shift, Equipment.of(1, 0, 0), Equipment.of(6, 6, 4));
        staff.setTravelMatrix(matrix);

        List<Visit> visits = orders.stream()
                .map(order -> new Visit(order, repair))
                .toList();

        ServiceCenter center = new ServiceCenter("SC-01", "СЦ «Север»", "ул. Победы, 30",
                56.8941, 60.6105, LocalTime.of(8, 0), LocalTime.of(21, 0), 15);

        DaySolution problem = new DaySolution(DATE, NOW, new ArrayList<>(visits), new ArrayList<>(List.of(staff)),
                List.of(repair), List.of(center), matrix);

        SolverConfig config = new SolverConfig()
                .withSolutionClass(DaySolution.class)
                .withEntityClasses(Staff.class, Visit.class)
                .withConstraintProviderClass(DispatchConstraintProvider.class)
                .withTerminationSpentLimit(Duration.ofSeconds(5));

        Solver<DaySolution> solver = SolverFactory.<DaySolution>create(config).buildSolver();
        DaySolution solution = solver.solve(problem);

        assertNotNull(solution.getScore());
        assertTrue(solution.getScore().isFeasible(), "Ожидался допустимый план, получен " + solution.getScore());

        long assigned = solution.getVisits().stream().filter(Visit::isAssigned).count();
        assertEquals(3, assigned, "С заездом в СЦ все три наряда должны быть назначены");
        assertTrue(solution.getVisits().stream().anyMatch(Visit::hasRestock),
                "Ожидался хотя бы один заезд в СЦ за пополнением АО");

        DayInput day = new DayInput(DATE, NOW, List.of(), List.of());
        Plan plan = new PlanAssembler().assemble(solution, day, List.of(), 1, 0L, null);

        List<Stop> stops = plan.routes().get(0).stops();
        assertTrue(stops.stream().anyMatch(s -> "RESTOCK".equals(s.type())),
                "В плане должна быть остановка RESTOCK");
        for (Stop stop : stops) {
            if ("VISIT".equals(stop.type()) && stop.equipmentAfter() != null) {
                assertTrue(stop.equipmentAfter().ont() >= 0
                                && stop.equipmentAfter().router() >= 0
                                && stop.equipmentAfter().stb() >= 0,
                        "Остаток АО не может быть отрицательным: " + stop.orderId());
            }
        }
    }
}
