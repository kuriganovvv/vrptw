package ru.sibsutis.vrptw_backend.web.plan;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import ru.sibsutis.vrptw_backend.domain.model.DaySolution;
import ru.sibsutis.vrptw_backend.domain.model.Equipment;
import ru.sibsutis.vrptw_backend.domain.model.Staff;
import ru.sibsutis.vrptw_backend.domain.model.Visit;
import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.plan.*;

@Component
public class PlanAssembler {


    private static final String TYPE_DEPOT = "DEPOT";
    private static final String TYPE_VISIT = "VISIT";
    private static final String TYPE_BREAK = "BREAK";
    private static final String STATUS_PLANNED = "PLANNED";
    private static final String REASON_NO_STAFF = "NO_QUALIFIED_STAFF";
    private static final String REASON_NO_TIME = "NO_SHIFT_CAPACITY";
    private static final String ACTION_RESCHEDULE = "RESCHEDULE";

    public Plan assemble(DaySolution solution, DayInput day, List<PgpGroup> pgpGroups,
                         int planVersion, long computationMs) {
        List<Route> routes = new ArrayList<>();
        List<Double> utilizations = new ArrayList<>();
        long travelTotal = 0;
        for (Staff staff : solution.getStaff()) {
            Route route = route(staff, solution.getNow());
            routes.add(route);
            utilizations.add(route.totals().utilization());
            travelTotal += route.totals().travelSec();
        }
        List<UnassignedOrder> unassigned = unassigned(solution);
        int visitsPlanned = (int) solution.getVisits().stream().filter(Visit::isAssigned).count();
        int pgpOrders = pgpGroups.stream().mapToInt(g -> g.orderIds().size()).sum();
        PlanSummary summary = new PlanSummary(
                day.orders() == null ? 0 : day.orders().size(),
                visitsPlanned, unassigned.size(), pgpOrders, 0, travelTotal, cv(utilizations));
        return new Plan(solution.getDate(), planVersion, null, day.now(), computationMs,
                routes, unassigned, pgpGroups, List.of(), List.of(), summary);
    }

    private Route route(Staff staff, OffsetDateTime now) {
        List<Stop> stops = new ArrayList<>();
        int seq = 1;
        OffsetDateTime shiftStart = staff.shiftStart(now);
        Equipment remaining = staff.getEquipmentStart();
        stops.add(new Stop(seq++, TYPE_DEPOT, staff.getServiceCenterId(), null,
                shiftStart, shiftStart, shiftStart, 0L, 0L, STATUS_PLANNED, dto(remaining), null));

        long travelSec = 0;
        long distanceM = 0;
        int workMin = 0;
        for (Visit visit : staff.getVisits()) {
            Visit.Timings t = visit.getTimings();
            if (t == null) {
                continue;
            }
            remaining = remaining.minus(visit.getOrder().getRequiredEquipment());
            travelSec += t.travelSec();
            distanceM += t.distanceM();
            workMin += visit.getWorkType().durationMin();
            stops.add(new Stop(seq++, TYPE_VISIT, visit.locationId(), visit.getOrder().getOrderId(),
                    t.arrival(), t.start(), t.end(), t.travelSec(), t.distanceM(),
                    STATUS_PLANNED, dto(remaining), null));
            if (t.breakStart() != null) {
                stops.add(new Stop(seq++, TYPE_BREAK, visit.locationId(), null,
                        t.breakStart(), t.breakStart(), t.breakEnd(), 0L, 0L,
                        STATUS_PLANNED, dto(remaining), null));
            }
        }

        long backSec = 0;
        long backM = 0;
        OffsetDateTime backAt = shiftStart;
        List<Visit> visits = staff.getVisits();
        if (!visits.isEmpty() && visits.get(visits.size() - 1).getTimings() != null) {
            Visit last = visits.get(visits.size() - 1);
            backSec = staff.travelBackSec(last.locationId());
            backM = staff.getTravelMatrix() == null ? 0
                    : staff.getTravelMatrix().distanceM(last.locationId(), staff.getServiceCenterId());
            backAt = last.getTimings().departure().plusSeconds(backSec);
            travelSec += backSec;
            distanceM += backM;
        }
        stops.add(new Stop(seq++, TYPE_DEPOT, staff.getServiceCenterId(), null,
                backAt, backAt, backAt, backSec, backM, STATUS_PLANNED, dto(remaining), null));

        long shiftSec = Duration.between(shiftStart, staff.shiftEnd(now)).toSeconds();
        double utilization = shiftSec <= 0 ? 0 : (workMin * 60.0 + travelSec) / shiftSec;
        RouteTotals totals = new RouteTotals(visits.size(), travelSec, distanceM, workMin, utilization);
        return new Route(staff.getStaffId(), staff.getServiceCenterId(), STATUS_PLANNED, null, null, stops, totals);
    }

    private List<UnassignedOrder> unassigned(DaySolution solution) {
        List<UnassignedOrder> result = new ArrayList<>();
        for (Visit visit : solution.getVisits()) {
            if (visit.isAssigned()) {
                continue;
            }
            boolean qualified = solution.getStaff().stream().anyMatch(staff -> matches(staff, visit));
            result.add(new UnassignedOrder(visit.getOrder().getOrderId(),
                    qualified ? REASON_NO_TIME : REASON_NO_STAFF,
                    qualified ? "Не хватает времени смены у подходящих сотрудников"
                              : "Нет сотрудника с нужным профилем, технологией или допуском",
                    ACTION_RESCHEDULE, null, solution.getNow()));
        }
        return result;
    }

    private boolean matches(Staff staff, Visit visit) {
        boolean profile = visit.getWorkType().profiles().stream().anyMatch(staff.getProfiles()::contains);
        boolean technology = staff.hasTechnology(visit.getOrder().getTechnology());
        boolean height = !visit.getOrder().isRequiresHeight() || staff.isHeightPermit();
        return profile && technology && height;
    }

    private static double cv(List<Double> values) {
        if (values.size() < 2) {
            return 0;
        }
        double mean = values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        if (mean == 0) {
            return 0;
        }
        double variance = values.stream().mapToDouble(v -> (v - mean) * (v - mean)).average().orElse(0);
        return Math.sqrt(variance) / mean;
    }

    private static ru.sibsutis.vrptw_backend.dto.common.Equipment dto(Equipment e) {
        return new ru.sibsutis.vrptw_backend.dto.common.Equipment(e.ont(), e.router(), e.stb());
    }
}