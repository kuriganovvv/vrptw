package ru.sibsutis.vrptw_backend.domain.constraint;

import ru.sibsutis.vrptw_backend.domain.model.Visit;

import java.time.Duration;
import java.time.OffsetDateTime;

import ai.timefold.solver.core.api.score.HardMediumSoftScore;
import ai.timefold.solver.core.api.score.stream.Constraint;
import ai.timefold.solver.core.api.score.stream.ConstraintFactory;
import ai.timefold.solver.core.api.score.stream.ConstraintProvider;
import ai.timefold.solver.core.api.score.stream.Joiners;

import static ai.timefold.solver.core.api.score.stream.ConstraintCollectors.sum;


public class DispatchConstraintProvider implements ConstraintProvider {

    private static final int UNASSIGNED_PENALTY = 1_000_000;

    private static final int JOINT_GAP_WEIGHT = 100;

    private static final int JOINT_INCOMPLETE_PENALTY = UNASSIGNED_PENALTY - 1;

    private static final long JOINT_MAX_GAP_MIN = 5;

    @Override
    public Constraint[] defineConstraints(ConstraintFactory factory) {
        return new Constraint[] {
            profileMismatch(factory),
            technologyMismatch(factory),
            heightPermitMissing(factory),
            visitOutsideSlot(factory),
            breakOutsideWindow(factory),
            routeEndsAfterShift(factory),
            equipmentOverflow(factory),
            jointVisitDifferentStaff(factory),
            jointVisitStartGapHard(factory),
            jointVisitPairAssignment(factory),
            unassignedVisit(factory),
            deadlineMissed(factory),
            minimizeTravelTime(factory),
            jointVisitMinimizeGap(factory)
        };
    }


    private Constraint profileMismatch(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(visit -> visit.getStaff() != null)
            .filter(visit -> visit.getWorkType().profiles().stream()
                .noneMatch(visit.getStaff().getProfiles()::contains))
            .penalize(HardMediumSoftScore.ONE_HARD, visit -> 1)
            .asConstraint("H1 staff profile");
    }


    private Constraint technologyMismatch(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(visit -> visit.getStaff() != null)
            .filter(visit -> !visit.getStaff().hasTechnology(visit.getOrder().getTechnology()))
            .penalize(HardMediumSoftScore.ONE_HARD, visit -> 1)
            .asConstraint("H1 staff technology");
    }


    private Constraint heightPermitMissing(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(Visit::isAssigned)
            .filter(visit -> visit.getOrder().isRequiresHeight()
                && !visit.getStaff().isHeightPermit())
            .penalize(HardMediumSoftScore.ONE_HARD, visit -> 1)
            .asConstraint("H1 height permit");
    }


    private Constraint visitOutsideSlot(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(visit -> visit.getTimings() != null)
            .filter(visit -> visit.getStart().isBefore(visit.getOrder().getSlotStart())
                || visit.getStart().isAfter(visit.getOrder().getLatestStart()))
            .penalize(HardMediumSoftScore.ONE_HARD, visit -> 1)
            .asConstraint("H4 visit outside slot");
    }

    private Constraint breakOutsideWindow(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(visit -> visit.getTimings() != null
                && visit.getTimings().breakStart() != null)
            .filter(visit -> visit.getTimings().breakStart().isBefore(
                    visit.getStaff().getShift()
                        .breakWindowFromAt(visit.getTimings().breakStart()))
                || visit.getTimings().breakStart().isAfter(
                    visit.getStaff().getShift()
                        .breakWindowToAt(visit.getTimings().breakStart())))
            .penalize(HardMediumSoftScore.ONE_HARD, visit -> 1)
            .asConstraint("H3 break outside window");
    }

    private Constraint routeEndsAfterShift(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(visit -> visit.getStaff() != null && visit.getNextVisit() == null)
            .filter(visit -> visit.getTimings() != null)
            .filter(visit -> {
                OffsetDateTime shiftEnd =
                    visit.getStaff().shiftEnd(visit.getTimings().departure());
                OffsetDateTime backAtDepot = visit.getTimings().departure()
                    .plusSeconds(visit.getStaff().travelBackSec(visit.locationId()));
                return backAtDepot.isAfter(shiftEnd);
            })
            .penalize(HardMediumSoftScore.ONE_HARD, visit -> 1)
            .asConstraint("H2 route ends after shift");
    }


    private Constraint equipmentOverflow(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(Visit::isAssigned)
            .filter(v -> !v.isJoint() || v.isPrimaryJoint())
            .groupBy(Visit::getStaff,
                sum(visit -> visit.getOrder().getRequiredEquipment().ont()),
                sum(visit -> visit.getOrder().getRequiredEquipment().router()),
                sum(visit -> visit.getOrder().getRequiredEquipment().stb()))
            .filter((staff, ont, router, stb) -> ont > staff.getEquipmentStart().ont()
                || router > staff.getEquipmentStart().router()
                || stb > staff.getEquipmentStart().stb())
            .penalize(HardMediumSoftScore.ONE_HARD, (staff, ont, router, stb) -> 1)
            .asConstraint("H7 equipment shortage");
    }

    /**
     * Половина совместного наряда почти так же бесполезна, как невыполненный наряд,
     * поэтому штраф чуть меньше штрафа за нераспределённый визит: солверу выгодно
     * назначить первую половину (иначе он оставит обе нераспределёнными), а затем
     * обязан назначить вторую, чтобы убрать штраф полностью.
     */
    private Constraint jointVisitPairAssignment(ConstraintFactory factory) {
        return factory.forEachIncludingUnassigned(Visit.class)
                .filter(v -> v.isJoint() && v.getStaff() != null)
                .join(
                        factory.forEachIncludingUnassigned(Visit.class)
                                .filter(v -> v.isJoint() && v.getStaff() == null),
                        Joiners.equal(Visit::getJointGroupId))
                .penalize(HardMediumSoftScore.ONE_MEDIUM,
                        (assigned, unassigned) -> JOINT_INCOMPLETE_PENALTY)
                .asConstraint("Joint visit pair incomplete");
    }


    private Constraint jointVisitDifferentStaff(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(Visit::isJoint)
            .join(Visit.class,
                Joiners.equal(Visit::getJointGroupId),
                Joiners.lessThan(Visit::getVisitId))
            .filter((v1, v2) -> v1.getStaff() != null && v2.getStaff() != null
                && v1.getStaff().getStaffId().equals(v2.getStaff().getStaffId()))
            .penalize(HardMediumSoftScore.ONE_HARD, (v1, v2) -> 1)
            .asConstraint("Joint visit same staff");
    }


    private Constraint jointVisitStartGapHard(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(v -> v.isJoint() && v.getTimings() != null)
            .join(Visit.class,
                Joiners.equal(Visit::getJointGroupId),
                Joiners.lessThan(Visit::getVisitId))
            .filter((v1, v2) -> v2.isJoint() && v2.getTimings() != null)
            .filter((v1, v2) ->
                Math.abs(Duration.between(v1.getStart(), v2.getStart()).toMinutes())
                    > JOINT_MAX_GAP_MIN)
            .penalize(HardMediumSoftScore.ONE_HARD, (v1, v2) -> 1)
            .asConstraint("Joint visit start gap exceeds limit");
    }


    private Constraint jointVisitMinimizeGap(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(v -> v.isJoint() && v.getTimings() != null)
            .join(Visit.class,
                Joiners.equal(Visit::getJointGroupId),
                Joiners.lessThan(Visit::getVisitId))
            .filter((v1, v2) -> v2.isJoint() && v2.getTimings() != null)
            .penalize(HardMediumSoftScore.ONE_SOFT, (v1, v2) ->
                (int) (Math.abs(Duration.between(v1.getStart(), v2.getStart()).toMinutes())
                    * JOINT_GAP_WEIGHT))
            .asConstraint("Joint visit minimize start gap");
    }


    private Constraint unassignedVisit(ConstraintFactory factory) {
        return factory.forEachIncludingUnassigned(Visit.class)
            .filter(visit -> visit.getStaff() == null)
            .penalize(HardMediumSoftScore.ONE_MEDIUM, visit -> UNASSIGNED_PENALTY)
            .asConstraint("Order unassigned");
    }


    private Constraint deadlineMissed(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(v -> !v.isJoint() || v.isPrimaryJoint())
            .filter(visit -> visit.getEnd() != null
                && visit.getEnd().isAfter(visit.getOrder().getDeadline()))
            .penalize(HardMediumSoftScore.ONE_MEDIUM,
                visit -> (int) (minutesLate(visit.getEnd(), visit.getOrder().getDeadline())
                    * (visit.getOrder().isRepeat() ? 2 : 1)))
            .asConstraint("Deadline missed");
    }


    private Constraint minimizeTravelTime(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
            .filter(visit -> visit.getTimings() != null)
            .penalize(HardMediumSoftScore.ONE_SOFT,
                visit -> (int) visit.getTimings().travelSec())
            .asConstraint("Minimize travel time");
    }


    private static long minutesLate(OffsetDateTime actual, OffsetDateTime deadline) {
        return Math.max(0, Duration.between(deadline, actual).toMinutes());
    }
}
