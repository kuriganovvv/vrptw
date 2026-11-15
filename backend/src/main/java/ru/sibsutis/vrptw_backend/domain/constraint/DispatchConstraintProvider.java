package ru.sibsutis.vrptw_backend.domain.constraint;

import ru.sibsutis.vrptw_backend.domain.model.Equipment;
import ru.sibsutis.vrptw_backend.domain.model.Visit;

import java.time.Duration;
import java.time.OffsetDateTime;
import ai.timefold.solver.core.api.score.HardMediumSoftScore;
import ai.timefold.solver.core.api.score.stream.Constraint;
import ai.timefold.solver.core.api.score.stream.ConstraintFactory;
import ai.timefold.solver.core.api.score.stream.ConstraintProvider;

public class DispatchConstraintProvider implements ConstraintProvider {

    private static final int UNASSIGNED_PENALTY = 1_000_000;

    @Override
    public Constraint[] defineConstraints(ConstraintFactory factory) {
        return new Constraint[] {
                profileMismatch(factory),
                technologyMismatch(factory),
                heightPermitMissing(factory),
                visitOutsideSlot(factory),
                breakOutsideWindow(factory),
                routeEndsAfterShift(factory),
                equipmentResidual(factory),
                unassignedVisit(factory),
                deadlineMissed(factory),
                minimizeTravelTime(factory)
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
                .filter(visit -> visit.getOrder().isRequiresHeight() && !visit.getStaff().isHeightPermit())
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
                .filter(visit -> visit.getTimings() != null && visit.getTimings().breakStart() != null)
                .filter(visit -> visit.getTimings().breakStart().isBefore(
                        visit.getStaff().getShift().breakWindowFromAt(visit.getTimings().breakStart()))
                        || visit.getTimings().breakStart().isAfter(
                                visit.getStaff().getShift().breakWindowToAt(visit.getTimings().breakStart())))
                .penalize(HardMediumSoftScore.ONE_HARD, visit -> 1)
                .asConstraint("H3 break outside window");
    }

    private Constraint routeEndsAfterShift(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
                .filter(visit -> visit.getStaff() != null && visit.getNextVisit() == null)
                .filter(visit -> visit.getTimings() != null)
                .filter(visit -> {
                    OffsetDateTime shiftEnd = visit.getStaff().shiftEnd(visit.getTimings().departure());
                    OffsetDateTime backAtDepot = visit.getTimings().departure()
                            .plusSeconds(visit.getStaff().travelBackSec(visit.locationId()));
                    return backAtDepot.isAfter(shiftEnd);
                })
                .penalize(HardMediumSoftScore.ONE_HARD, visit -> 1)
                .asConstraint("H2 route ends after shift");
    }

    private Constraint equipmentResidual(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
                .filter(visit -> visit.getEquipmentAfter() != null)
                .filter(visit -> {
                    Equipment after = visit.getEquipmentAfter();
                    return after.ont() < 0 || after.router() < 0 || after.stb() < 0;
                })
                .penalize(HardMediumSoftScore.ONE_HARD, visit -> 1)
                .asConstraint("H7 equipment residual");
    }

    private Constraint unassignedVisit(ConstraintFactory factory) {
        return factory.forEachIncludingUnassigned(Visit.class)
                .filter(visit -> visit.getStaff() == null)
                .penalize(HardMediumSoftScore.ONE_MEDIUM, visit -> UNASSIGNED_PENALTY)
                .asConstraint("Order unassigned");
    }

    private Constraint deadlineMissed(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
                .filter(visit -> visit.getEnd() != null && visit.getEnd().isAfter(visit.getOrder().getDeadline()))
                .penalize(HardMediumSoftScore.ONE_MEDIUM,
                        visit -> (int) (minutesLate(visit.getEnd(), visit.getOrder().getDeadline())
                                * (visit.getOrder().isRepeat() ? 2 : 1)))
                .asConstraint("Deadline missed");
    }

    private Constraint minimizeTravelTime(ConstraintFactory factory) {
        return factory.forEach(Visit.class)
                .filter(visit -> visit.getTimings() != null)
                .penalize(HardMediumSoftScore.ONE_SOFT, visit -> (int) visit.getTimings().travelSec())
                .asConstraint("Minimize travel time");
    }

    private static long minutesLate(OffsetDateTime actual, OffsetDateTime deadline) {
        return Math.max(0, Duration.between(deadline, actual).toMinutes());
    }
}
