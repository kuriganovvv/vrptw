package ru.sibsutis.vrptw_backend.web.plan;

import java.time.LocalDate;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import ai.timefold.solver.core.api.solver.SolverFactory;
import ru.sibsutis.vrptw_backend.domain.model.DaySolution;
import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;
import ru.sibsutis.vrptw_backend.service.DaySolutionFactory;
import ru.sibsutis.vrptw_backend.web.pgp.PgpDetector;
import ru.sibsutis.vrptw_backend.web.storage.InMemoryDataStore;

@Service
public class PlanningService {

    private final InMemoryDataStore store;
    private final SolverFactory<DaySolution> solverFactory; // бин из timefold-solver-spring-boot-starter
    private final PgpDetector pgpDetector;
    private final PlanAssembler assembler;
    private final DaySolutionFactory solutionFactory = new DaySolutionFactory();
    private final ReentrantLock lock = new ReentrantLock();

    public PlanningService(InMemoryDataStore store, SolverFactory<DaySolution> solverFactory,
                           PgpDetector pgpDetector, PlanAssembler assembler) {
        this.store = store;
        this.solverFactory = solverFactory;
        this.pgpDetector = pgpDetector;
        this.assembler = assembler;
    }

    public Plan plan(LocalDate date) {
        ReferenceData reference = store.findReference().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "Справочники не загружены: PUT /api/v1/reference"));
        TravelMatrix matrix = store.findTravelMatrix().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "Матрица не загружена: PUT /api/v1/travel-matrix"));
        DayInput day = store.findDay(date).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Наряды не загружены: PUT /api/v1/days/" + date));

        if (!lock.tryLock()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Планирование уже выполняется, повторите позже");
        }
        try {
            long start = System.nanoTime();
            PgpDetector.Result pgp = pgpDetector.detect(day, reference);
            DayInput planned = new DayInput(day.date(), day.now(), pgp.plannedOrders(), day.absentStaffIds());
            DaySolution problem = solutionFactory.build(reference, planned, matrix);
            DaySolution solved = solverFactory.buildSolver().solve(problem);
            long computationMs = (System.nanoTime() - start) / 1_000_000;
            Plan plan = assembler.assemble(solved, day, pgp.groups(), store.nextPlanVersion(date), computationMs);
            store.savePlan(date, plan);
            return plan;
        } finally {
            lock.unlock();
        }
    }
}