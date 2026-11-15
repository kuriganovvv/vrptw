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
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;

@Component
public class PlanAssembler {

    private static final String TYPE_DEPOT_START = "DEPOT_START";
    private static final String TYPE_DEPOT_END = "DEPOT_END";
    private static final String TYPE_VISIT = "VISIT";
    private static final String TYPE_BREAK = "BREAK";
    private static final String TYPE_RESTOCK = "RESTOCK";
    private static final String STATUS_PLANNED = "PLANNED";
    private static final String REASON_NO_STAFF = "NO_QUALIFIED_STAFF";
    private static final String REASON_NO_EQUIPMENT = "NO_EQUIPMENT";
    private static final String REASON_SLOT = "SLOT_UNREACHABLE";
    private static final String REASON_NO_TIME = "NO_SHIFT_TIME";
    private static final String REASON_UNAVAILABLE = "STAFF_UNAVAILABLE";
    private static final String REASON_OTHER = "OTHER";
    private static final String ACTION_RESCHEDULE = "RESCHEDULE";
    private static final String ACTION_REASSIGN = "REASSIGN";

    public Plan assemble(DaySolution solution, DayInput day, List<PgpGroup> pgpGroups,
                         int planVersion, long computationMs, ReferenceData reference) {
        List<Route> routes = new ArrayList<>();
        List<Double> utilizations = new ArrayList<>();
        long travelTotal = 0;
        for (Staff staff : solution.getStaff()) {
            Route route = route(staff, solution.getNow());
            routes.add(route);
            utilizations.add(route.totals().utilization());
            travelTotal += route.totals().travelSec();
        }
        List<UnassignedOrder> unassigned = unassigned(solution, reference);
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
        stops.add(new Stop(seq++, TYPE_DEPOT_START, staff.getServiceCenterId(), null,
                shiftStart, shiftStart, shiftStart, 0L, 0L, STATUS_PLANNED, dto(remaining), null));

        long travelSec = 0;
        long distanceM = 0;
        int workMin = 0;
        for (Visit visit : staff.getVisits()) {
            Visit.Timings t = visit.getTimings();
            if (t == null) {
                continue;
            }

            if (t.restockStart() != null) {
                stops.add(new Stop(seq++, TYPE_RESTOCK, t.restockLocationId(), null,
                        t.restockStart(), t.restockStart(), t.restockEnd(),
                        t.restockTravelSec(), t.restockDistanceM(),
                        STATUS_PLANNED, dto(staff.getEquipmentCapacity()), null));
                travelSec += t.restockTravelSec();
                distanceM += t.restockDistanceM();
                remaining = staff.getEquipmentCapacity();
            }

            if (t.breakStart() != null) {
                stops.add(new Stop(seq++, TYPE_BREAK, t.breakLocationId(), null,
                        t.breakStart(), t.breakStart(), t.breakEnd(), 0L, 0L,
                        STATUS_PLANNED, dto(remaining), null));
            }
            remaining = t.equipmentAfter() == null
                    ? remaining.minus(visit.getOrder().getRequiredEquipment())
                    : t.equipmentAfter();
            travelSec += t.travelSec();
            distanceM += t.distanceM();
            workMin += visit.getWorkType().durationMin();
            stops.add(new Stop(seq++, TYPE_VISIT, visit.locationId(), visit.getOrder().getOrderId(),
                    t.arrival(), t.start(), t.end(), t.travelSec(), t.distanceM(),
                    STATUS_PLANNED, dto(remaining), null));
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
        stops.add(new Stop(seq++, TYPE_DEPOT_END, staff.getServiceCenterId(), null,
                backAt, backAt, backAt, backSec, backM, STATUS_PLANNED, dto(remaining), null));

        long shiftSec = Duration.between(shiftStart, staff.shiftEnd(now)).toSeconds();
        double utilization = shiftSec <= 0 ? 0 : (workMin * 60.0 + travelSec) / shiftSec;
        RouteTotals totals = new RouteTotals(visits.size(), travelSec, distanceM, workMin, utilization);
        return new Route(staff.getStaffId(), staff.getServiceCenterId(), "ACTIVE", null, null, stops, totals);
    }

    /** Порядок по записке: H1 → H7 → H4 → H2 → STAFF_UNAVAILABLE → OTHER. */
    private List<UnassignedOrder> unassigned(DaySolution solution, ReferenceData reference) {
        List<UnassignedOrder> result = new ArrayList<>();
        for (Visit visit : solution.getVisits()) {
            if (visit.isAssigned()) {
                continue;
            }
            result.add(classify(visit, solution, reference));
        }
        return result;
    }

    private UnassignedOrder classify(Visit visit, DaySolution solution, ReferenceData reference) {
        List<Staff> qualified = solution.getStaff().stream().filter(s -> matches(s, visit)).toList();
        boolean anyInReference = reference == null || reference.staff() == null
                ? !qualified.isEmpty()
                : reference.staff().stream().anyMatch(rs -> matchesRef(rs, visit));

        String code;
        String text;
        String action;
        if (!anyInReference) {
            code = REASON_NO_STAFF;
            text = "Нет сотрудника с нужным профилем, технологией или допуском";
            action = ACTION_REASSIGN;
        } else if (qualified.isEmpty()) {
            code = REASON_UNAVAILABLE;
            text = "Все подходящие сотрудники недоступны в эту смену";
            action = ACTION_REASSIGN;
        } else if (qualified.stream().noneMatch(s ->
                visit.getOrder().getRequiredEquipment().fitsInto(s.getEquipmentStart()))) {
            code = REASON_NO_EQUIPMENT;
            text = "Потребность в АО превышает запас в рюкзаке подходящих сотрудников";
            action = ACTION_REASSIGN;
        } else if (qualified.stream().noneMatch(s -> canReachSlot(s, visit, solution.getNow()))) {
            code = REASON_SLOT;
            text = "Ни один подходящий сотрудник не успевает начать визит до latest_start";
            action = ACTION_RESCHEDULE;
        } else if (qualified.stream().noneMatch(s -> fitsShift(s, visit, solution.getNow()))) {
            code = REASON_NO_TIME;
            text = "Не хватает времени смены у подходящих сотрудников";
            action = ACTION_RESCHEDULE;
        } else {
            code = REASON_OTHER;
            text = "Солвер не нашёл допустимое место в маршрутах (комбинация ограничений)";
            action = ACTION_RESCHEDULE;
        }
        return new UnassignedOrder(visit.getOrder().getOrderId(), code, text, action, null, solution.getNow());
    }

    private boolean matches(Staff staff, Visit visit) {
        boolean profile = visit.getWorkType().profiles().stream().anyMatch(staff.getProfiles()::contains);
        boolean technology = staff.hasTechnology(visit.getOrder().getTechnology());
        boolean height = !visit.getOrder().isRequiresHeight() || staff.isHeightPermit();
        return profile && technology && height;
    }

    private boolean matchesRef(ru.sibsutis.vrptw_backend.dto.reference.Staff rs, Visit visit) {
        boolean profile = rs.profiles() != null && visit.getWorkType().profiles().stream()
                .anyMatch(p -> rs.profiles().contains(p.name()));
        boolean technology = rs.technologies() != null
                && rs.technologies().contains(visit.getOrder().getTechnology().name());
        boolean height = !visit.getOrder().isRequiresHeight() || rs.heightPermit();
        return profile && technology && height;
    }

    private OffsetDateTime earliestStart(Staff staff, Visit visit, OffsetDateTime now) {
        OffsetDateTime shiftStart = staff.shiftStart(now);
        OffsetDateTime base = now.isAfter(shiftStart) ? now : shiftStart;
        int travel = staff.getTravelMatrix() == null ? 0
                : staff.getTravelMatrix().travelSec(staff.getServiceCenterId(), visit.locationId());
        OffsetDateTime earliest = base.plusSeconds(travel);
        return earliest.isBefore(visit.getOrder().getSlotStart()) ? visit.getOrder().getSlotStart() : earliest;
    }

    private boolean canReachSlot(Staff staff, Visit visit, OffsetDateTime now) {
        return !earliestStart(staff, visit, now).isAfter(visit.getOrder().getLatestStart());
    }

    private boolean fitsShift(Staff staff, Visit visit, OffsetDateTime now) {
        OffsetDateTime end = earliestStart(staff, visit, now)
                .plusMinutes(visit.getWorkType().durationMin())
                .plusSeconds(staff.travelBackSec(visit.locationId()));
        return !end.isAfter(staff.shiftEnd(now));
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
