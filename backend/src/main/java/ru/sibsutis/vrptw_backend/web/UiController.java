package ru.sibsutis.vrptw_backend.web;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.ui.UiDay;
import ru.sibsutis.vrptw_backend.web.plan.PlanningService;
import ru.sibsutis.vrptw_backend.web.storage.InMemoryDataStore;

@RestController
@RequestMapping("/api/v1/ui")
public class UiController {

    private final InMemoryDataStore store;
    private final PlanningService planning;

    public UiController(InMemoryDataStore store, PlanningService planning) {
        this.store = store;
        this.planning = planning;
    }

    @GetMapping("/days")
    public List<UiDay> days() {
        return store.loadedDates().stream()
                .sorted()
                .map(date -> new UiDay(date, store.now(date)))
                .toList();
    }

    @GetMapping("/days/{date}")
    public DayInput day(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return planning.currentDay(date);
    }

    @GetMapping("/reference")
    public ReferenceData reference() {
        return store.findReference().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "Справочники не загружены"));
    }
}
