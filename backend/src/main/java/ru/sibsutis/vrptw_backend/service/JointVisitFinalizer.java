package ru.sibsutis.vrptw_backend.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import ai.timefold.solver.core.api.solver.SolutionManager;
import ai.timefold.solver.core.api.solver.SolverFactory;
import ru.sibsutis.vrptw_backend.domain.model.DaySolution;
import ru.sibsutis.vrptw_backend.domain.model.Visit;

/**
 * Совместный наряд имеет смысл только целиком: два сотрудника выезжают одновременно.
 * Солвер может оставить одну половину назначенной, если вторую не удаётся встроить
 * без нарушения жёстких ограничений. Такая половина бесполезна, поэтому перед
 * сборкой плана снимаем её с маршрута — наряд целиком уйдёт в нераспределённые.
 */
public final class JointVisitFinalizer {

    private JointVisitFinalizer() {
    }

    public static void dropIncompletePairs(DaySolution solution,
                                           SolverFactory<DaySolution> solverFactory) {
        Map<String, List<Visit>> groups = new LinkedHashMap<>();
        for (Visit visit : solution.getVisits()) {
            if (visit.isJoint()) {
                groups.computeIfAbsent(visit.getJointGroupId(), id -> new ArrayList<>()).add(visit);
            }
        }

        boolean changed = false;
        for (List<Visit> group : groups.values()) {
            long assigned = group.stream().filter(Visit::isAssigned).count();
            if (assigned == 0 || assigned == group.size()) {
                continue;
            }
            for (Visit visit : group) {
                if (visit.getStaff() != null) {
                    visit.getStaff().getVisits().remove(visit);
                    changed = true;
                }
            }
        }

        if (changed) {
            // Пересчитываем теневые переменные: время, пробег и остатки АО
            // следующих визитов больше не должны учитывать снятую половину.
            SolutionManager.create(solverFactory).update(solution);
        }
    }
}
