package ru.sibsutis.vrptw_backend.domain.model;

import ru.sibsutis.vrptw_backend.domain.enums.Profile;
import ru.sibsutis.vrptw_backend.domain.enums.Technology;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import ai.timefold.solver.core.api.domain.common.PlanningId;
import ai.timefold.solver.core.api.domain.entity.PlanningEntity;
import ai.timefold.solver.core.api.domain.variable.PlanningListVariable;

@PlanningEntity
public class Staff {

    @PlanningId
    private String staffId;
    private String displayName;
    private String serviceCenterId;
    private Set<Profile> profiles = new LinkedHashSet<>();
    private Set<Technology> technologies = new LinkedHashSet<>();
    private boolean heightPermit;
    private Shift shift;
    private Equipment equipmentStart = Equipment.ZERO;
    private Equipment equipmentCapacity = Equipment.ZERO;
    private double experienceYears;
    private TravelMatrix travelMatrix;
    /** Начало доступности после уже начатого визита (VISIT_DELAYED / ORDER_TRANSFERRED). */
    private OffsetDateTime availableFrom;

    @PlanningListVariable(allowsUnassignedValues = true)
    private List<Visit> visits = new ArrayList<>();

    public Staff() {
    }

    public Staff(String staffId, String serviceCenterId, Set<Profile> profiles,
                 Set<Technology> technologies, boolean heightPermit, Shift shift,
                 Equipment equipmentStart, Equipment equipmentCapacity) {
        this.staffId = staffId;
        this.serviceCenterId = serviceCenterId;
        this.profiles = new LinkedHashSet<>(profiles);
        this.technologies = new LinkedHashSet<>(technologies);
        this.heightPermit = heightPermit;
        this.shift = shift;
        this.equipmentStart = equipmentStart;
        this.equipmentCapacity = equipmentCapacity;
    }

    public OffsetDateTime shiftStart(OffsetDateTime day) {
        return shift.startAt(day);
    }

    public OffsetDateTime shiftEnd(OffsetDateTime day) {
        return shift.endAt(day);
    }

    /** Сотрудник не может начать следующую остановку раньше конца уже начатого визита. */
    public OffsetDateTime startOfAvailability(OffsetDateTime day) {
        OffsetDateTime shiftStart = shiftStart(day);
        return availableFrom != null && availableFrom.isAfter(shiftStart) ? availableFrom : shiftStart;
    }

    public OffsetDateTime getAvailableFrom() {
        return availableFrom;
    }

    public void setAvailableFrom(OffsetDateTime availableFrom) {
        this.availableFrom = availableFrom;
    }

    public boolean hasProfile(Profile profile) {
        return profiles.contains(profile);
    }

    public boolean hasTechnology(Technology technology) {
        return technologies.contains(technology);
    }

    public int travelBackSec(String buildingId) {
        return travelMatrix == null ? 0 : travelMatrix.travelSec(buildingId, serviceCenterId);
    }

    public TravelMatrix getTravelMatrix() {
        return travelMatrix;
    }

    public void setTravelMatrix(TravelMatrix travelMatrix) {
        this.travelMatrix = travelMatrix;
    }

    public String getStaffId() {
        return staffId;
    }

    public void setStaffId(String staffId) {
        this.staffId = staffId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getServiceCenterId() {
        return serviceCenterId;
    }

    public void setServiceCenterId(String serviceCenterId) {
        this.serviceCenterId = serviceCenterId;
    }

    public Set<Profile> getProfiles() {
        return profiles;
    }

    public void setProfiles(Set<Profile> profiles) {
        this.profiles = profiles;
    }

    public Set<Technology> getTechnologies() {
        return technologies;
    }

    public void setTechnologies(Set<Technology> technologies) {
        this.technologies = technologies;
    }

    public boolean isHeightPermit() {
        return heightPermit;
    }

    public void setHeightPermit(boolean heightPermit) {
        this.heightPermit = heightPermit;
    }

    public Shift getShift() {
        return shift;
    }

    public void setShift(Shift shift) {
        this.shift = shift;
    }

    public Equipment getEquipmentStart() {
        return equipmentStart;
    }

    public void setEquipmentStart(Equipment equipmentStart) {
        this.equipmentStart = equipmentStart;
    }

    public Equipment getEquipmentCapacity() {
        return equipmentCapacity;
    }

    public void setEquipmentCapacity(Equipment equipmentCapacity) {
        this.equipmentCapacity = equipmentCapacity;
    }

    public double getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(double experienceYears) {
        this.experienceYears = experienceYears;
    }

    public List<Visit> getVisits() {
        return visits;
    }

    public void setVisits(List<Visit> visits) {
        this.visits = visits;
    }
}
