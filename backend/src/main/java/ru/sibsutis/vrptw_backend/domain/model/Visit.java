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

        if (previousVisit == null) {
            if (staff.getShift() == null) {
                return null;
            }
            base = staff.shiftStart(solution.getNow());
            fromLocation = staff.getServiceCenterId();
            breakDone = false;
            cumulativeTravelSec = 0;
            cumulativeDistanceM = 0;
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
        }

        TravelMatrix matrix = solution.getTravelMatrix();
        int travelSec = matrix.travelSec(fromLocation, order.getBuildingId());
        int distanceM = matrix.distanceM(fromLocation, order.getBuildingId());

        OffsetDateTime arrival = base.plusSeconds(travelSec);
        OffsetDateTime start = arrival.isBefore(order.getSlotStart()) ? order.getSlotStart() : arrival;
        OffsetDateTime end = start.plusMinutes(workType.durationMin());

        OffsetDateTime breakStart = null;
        OffsetDateTime breakEnd = null;
        OffsetDateTime departure = end;

        if (!breakDone && !end.isBefore(staff.getShift().breakWindowFromAt(solution.getNow()))) {
            breakStart = end;
            breakEnd = breakStart.plusMinutes(staff.getShift().breakDurationMin());
            departure = breakEnd;
            breakDone = true;
        }

        return new Timings(arrival, start, end, departure, travelSec, distanceM,
                cumulativeTravelSec + travelSec,
                cumulativeDistanceM + distanceM,
                breakStart, breakEnd, breakDone);
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
            boolean breakDone) {
    }
}
