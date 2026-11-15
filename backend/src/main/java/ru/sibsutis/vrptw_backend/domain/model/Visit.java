package ru.sibsutis.vrptw_backend.domain.model;

import java.time.OffsetDateTime;

import ai.timefold.solver.core.api.domain.common.PlanningId;
import ai.timefold.solver.core.api.domain.entity.PlanningEntity;
import ai.timefold.solver.core.api.domain.variable.InverseRelationShadowVariable;
import ai.timefold.solver.core.api.domain.variable.NextElementShadowVariable;
import ai.timefold.solver.core.api.domain.variable.PreviousElementShadowVariable;
import ai.timefold.solver.core.api.domain.variable.ShadowSources;
import ai.timefold.solver.core.api.domain.variable.ShadowVariable;

@PlanningEntity
public class Visit {

    @PlanningId
    private String visitId;
    private Order order;
    private WorkType workType;
    private String jointGroupId;
    private boolean primaryJoint;

    @InverseRelationShadowVariable(sourceVariableName = "visits")
    private Staff staff;

    @PreviousElementShadowVariable(sourceVariableName = "visits")
    private Visit previousVisit;

    @NextElementShadowVariable(sourceVariableName = "visits")
    private Visit nextVisit;

    @ShadowVariable(supplierName = "timingsSupplier")
    private Timings timings;

    public Visit() {
    }

    public boolean isJoint() {
        return jointGroupId != null;
    }

    public String getJointGroupId() {
        return jointGroupId;
    }

    public void setJointGroupId(String jointGroupId) {
        this.jointGroupId = jointGroupId;
    }

    public boolean isPrimaryJoint() {
        return primaryJoint;
    }

    public void setPrimaryJoint(boolean primaryJoint) {
        this.primaryJoint = primaryJoint;
    }

    public Visit(Order order, WorkType workType) {
        this.visitId = order.getOrderId();
        this.order = order;
        this.workType = workType;
    }

    @ShadowSources({ "staff", "previousVisit.timings" })
    public Timings timingsSupplier(DaySolution solution) {
        if (staff == null) {
            return null;
        }
        OffsetDateTime base;
        String fromLocation;
        boolean breakDone;
        long cumulativeTravelSec;
        long cumulativeDistanceM;
        Equipment remaining;

        if (previousVisit == null) {
            if (staff.getShift() == null) {
                return null;
            }
            base = staff.startOfAvailability(solution.getNow());
            fromLocation = staff.getServiceCenterId();
            breakDone = false;
            cumulativeTravelSec = 0;
            cumulativeDistanceM = 0;
            remaining = staff.getEquipmentStart();
        } else {
            Timings previousTimings = previousVisit.getTimings();
            if (previousTimings == null) {
                return null;
            }
            base = previousTimings.departure();
            fromLocation = previousVisit.locationId();
            breakDone = previousTimings.breakDone();
            cumulativeTravelSec = previousTimings.cumulativeTravelSec();
            cumulativeDistanceM = previousTimings.cumulativeDistanceM();
            remaining = previousTimings.equipmentAfter() == null
                    ? staff.getEquipmentStart()
                    : previousTimings.equipmentAfter();
        }

        TravelMatrix matrix = solution.getTravelMatrix();
        int travelSec = matrix.travelSec(fromLocation, order.getBuildingId());
        int distanceM = matrix.distanceM(fromLocation, order.getBuildingId());

        OffsetDateTime readyToTravel = base;
        // Совместный наряд выполняют два сотрудника, но оборудование везёт только
        // основной: вторая половина не должна повторно списывать запас и ехать на склад.
        Equipment required = !isJoint() || primaryJoint
                ? (order.getRequiredEquipment() == null ? Equipment.ZERO : order.getRequiredEquipment())
                : Equipment.ZERO;

        String restockLocationId = null;
        OffsetDateTime restockStart = null;
        OffsetDateTime restockEnd = null;
        long restockTravelSec = 0;
        long restockDistanceM = 0;

        if (solution.isRestockEnabled() && !required.fitsInto(remaining)) {
            ServiceCenter center = serviceCenter(solution, staff.getServiceCenterId());
            if (center != null) {
                long toCenterSec = matrix.travelSec(fromLocation, center.serviceCenterId());
                OffsetDateTime candidateStart = readyToTravel.plusSeconds(toCenterSec);
                OffsetDateTime candidateEnd = candidateStart.plusMinutes(center.restockDurationMin());
                if (isOpen(center, candidateStart, candidateEnd, solution.getNow())) {
                    restockLocationId = center.serviceCenterId();
                    restockTravelSec = toCenterSec;
                    restockDistanceM = matrix.distanceM(fromLocation, center.serviceCenterId());
                    restockStart = candidateStart;
                    restockEnd = candidateEnd;
                    cumulativeTravelSec += toCenterSec;
                    cumulativeDistanceM += restockDistanceM;
                    readyToTravel = candidateEnd;
                    fromLocation = center.serviceCenterId();
                    travelSec = matrix.travelSec(fromLocation, order.getBuildingId());
                    distanceM = matrix.distanceM(fromLocation, order.getBuildingId());
                    remaining = staff.getEquipmentCapacity();
                }
            }
        }

        Equipment equipmentAfter = remaining.minus(required);

        // Перерыв ставится на выезде к этому визиту, на локации предыдущей остановки,
        // как только окно обеда открылось и это не срывает слот текущего визита.
        // Так перерыв попадает в окно даже когда первый визит заканчивается позже него.
        OffsetDateTime breakStart = null;
        OffsetDateTime breakEnd = null;
        String breakLocationId = null;

        if (!breakDone) {
            OffsetDateTime windowFrom = staff.getShift().breakWindowFromAt(solution.getNow());
            OffsetDateTime windowTo = staff.getShift().breakWindowToAt(solution.getNow());
            OffsetDateTime candidateStart = readyToTravel.isBefore(windowFrom) ? windowFrom : readyToTravel;
            OffsetDateTime candidateEnd = candidateStart.plusMinutes(staff.getShift().breakDurationMin());
            boolean insideWindow = !candidateStart.isAfter(windowTo);
            boolean keepsSlot = !candidateEnd.plusSeconds(travelSec).isAfter(order.getLatestStart());
            if (insideWindow && keepsSlot) {
                breakStart = candidateStart;
                breakEnd = candidateEnd;
                breakLocationId = fromLocation;
                readyToTravel = candidateEnd;
                breakDone = true;
            }
        }

        OffsetDateTime arrival = readyToTravel.plusSeconds(travelSec);
        OffsetDateTime start = arrival.isBefore(order.getSlotStart()) ? order.getSlotStart() : arrival;
        OffsetDateTime end = start.plusMinutes(workType.durationMin());
        OffsetDateTime departure = end;

        return new Timings(arrival, start, end, departure, travelSec, distanceM,
                cumulativeTravelSec + travelSec,
                cumulativeDistanceM + distanceM,
                breakStart, breakEnd, breakLocationId, breakDone,
                restockStart, restockEnd, restockLocationId, restockTravelSec, restockDistanceM,
                equipmentAfter);
    }

    private static ServiceCenter serviceCenter(DaySolution solution, String serviceCenterId) {
        if (solution.getServiceCenters() == null) {
            return null;
        }
        for (ServiceCenter center : solution.getServiceCenters()) {
            if (center.serviceCenterId().equals(serviceCenterId)) {
                return center;
            }
        }
        return null;
    }

    private static boolean isOpen(ServiceCenter center, OffsetDateTime start, OffsetDateTime end,
                                  OffsetDateTime day) {
        if (center.openingFrom() == null || center.openingTo() == null) {
            return true;
        }
        OffsetDateTime open = Shift.localAt(day, center.openingFrom());
        OffsetDateTime close = Shift.localAt(day, center.openingTo());
        return !start.isBefore(open) && !end.isAfter(close);
    }

    public String locationId() {
        return order.getBuildingId();
    }

    public boolean isAssigned() {
        return staff != null;
    }

    public OffsetDateTime getArrival() {
        return timings == null ? null : timings.arrival();
    }

    public OffsetDateTime getStart() {
        return timings == null ? null : timings.start();
    }

    public OffsetDateTime getEnd() {
        return timings == null ? null : timings.end();
    }

    public OffsetDateTime getDeparture() {
        return timings == null ? null : timings.departure();
    }

    public Equipment getEquipmentAfter() {
        return timings == null ? null : timings.equipmentAfter();
    }

    public boolean hasRestock() {
        return timings != null && timings.restockStart() != null;
    }

    public String getVisitId() {
        return visitId;
    }

    public void setVisitId(String visitId) {
        this.visitId = visitId;
    }

    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
    }

    public WorkType getWorkType() {
        return workType;
    }

    public void setWorkType(WorkType workType) {
        this.workType = workType;
    }

    public Staff getStaff() {
        return staff;
    }

    public void setStaff(Staff staff) {
        this.staff = staff;
    }

    public Visit getPreviousVisit() {
        return previousVisit;
    }

    public void setPreviousVisit(Visit previousVisit) {
        this.previousVisit = previousVisit;
    }

    public Visit getNextVisit() {
        return nextVisit;
    }

    public void setNextVisit(Visit nextVisit) {
        this.nextVisit = nextVisit;
    }

    public Timings getTimings() {
        return timings;
    }

    public void setTimings(Timings timings) {
        this.timings = timings;
    }

    @Override
    public String toString() {
        return visitId;
    }

    public record Timings(
            OffsetDateTime arrival,
            OffsetDateTime start,
            OffsetDateTime end,
            OffsetDateTime departure,
            long travelSec,
            long distanceM,
            long cumulativeTravelSec,
            long cumulativeDistanceM,
            OffsetDateTime breakStart,
            OffsetDateTime breakEnd,
            String breakLocationId,
            boolean breakDone,
            OffsetDateTime restockStart,
            OffsetDateTime restockEnd,
            String restockLocationId,
            long restockTravelSec,
            long restockDistanceM,
            Equipment equipmentAfter) {
    }
}
