package ru.sibsutis.vrptw_backend.web;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import ru.sibsutis.vrptw_backend.dto.plan.Plan;
import ru.sibsutis.vrptw_backend.web.plan.PlanningService;
import ru.sibsutis.vrptw_backend.web.storage.DataStore;

@RestController
@RequestMapping("/api/v1/days/{date}/plan")
public class PlanController {

    private final PlanningService planning;
    private final DataStore store;

    public PlanController(PlanningService planning, DataStore store) {
        this.planning = planning;
        this.store = store;
    }

    @PostMapping
    public Plan buildPlan(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return planning.plan(date);
    }

    @GetMapping
    public Plan currentPlan(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return store.findPlan(date).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "План ещё не построен: POST /api/v1/days/" + date + "/plan"));
    }
}