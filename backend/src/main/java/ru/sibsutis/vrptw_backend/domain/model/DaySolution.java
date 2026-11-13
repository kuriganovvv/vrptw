package ru.sibsutis.vrptw_backend.domain.model;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import ai.timefold.solver.core.api.domain.solution.PlanningEntityCollectionProperty;
import ai.timefold.solver.core.api.domain.solution.PlanningScore;
import ai.timefold.solver.core.api.domain.solution.PlanningSolution;
import ai.timefold.solver.core.api.domain.solution.ProblemFactCollectionProperty;
import ai.timefold.solver.core.api.domain.solution.ProblemFactProperty;
import ai.timefold.solver.core.api.domain.valuerange.ValueRangeProvider;
import ai.timefold.solver.core.api.score.HardMediumSoftScore;

@PlanningSolution
public class DaySolution {

    private LocalDate date;
    private OffsetDateTime now;

    @PlanningEntityCollectionProperty
    @ValueRangeProvider
    private List<Visit> visits = new ArrayList<>();

    @PlanningEntityCollectionProperty
    private List<Staff> staff = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<WorkType> workTypes = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<ServiceCenter> serviceCenters = new ArrayList<>();

    @ProblemFactProperty
    private TravelMatrix travelMatrix;

    @PlanningScore
    private HardMediumSoftScore score;

    public DaySolution() {
    }

    public DaySolution(LocalDate date, OffsetDateTime now, List<Visit> visits, List<Staff> staff,
                       List<WorkType> workTypes, List<ServiceCenter> serviceCenters,
                       TravelMatrix travelMatrix) {
        this.date = date;
        this.now = now;
        this.visits = visits;
        this.staff = staff;
        this.workTypes = workTypes;
        this.serviceCenters = serviceCenters;
        this.travelMatrix = travelMatrix;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public OffsetDateTime getNow() {
        return now;
    }

    public void setNow(OffsetDateTime now) {
        this.now = now;
    }

    public List<Visit> getVisits() {
        return visits;
    }

    public void setVisits(List<Visit> visits) {
        this.visits = visits;
    }

    public List<Staff> getStaff() {
        return staff;
    }

    public void setStaff(List<Staff> staff) {
        this.staff = staff;
    }

    public List<WorkType> getWorkTypes() {
        return workTypes;
    }

    public void setWorkTypes(List<WorkType> workTypes) {
        this.workTypes = workTypes;
    }

    public List<ServiceCenter> getServiceCenters() {
        return serviceCenters;
    }

    public void setServiceCenters(List<ServiceCenter> serviceCenters) {
        this.serviceCenters = serviceCenters;
    }

    public TravelMatrix getTravelMatrix() {
        return travelMatrix;
    }

    public void setTravelMatrix(TravelMatrix travelMatrix) {
        this.travelMatrix = travelMatrix;
    }

    public HardMediumSoftScore getScore() {
        return score;
    }

    public void setScore(HardMediumSoftScore score) {
        this.score = score;
    }
}
