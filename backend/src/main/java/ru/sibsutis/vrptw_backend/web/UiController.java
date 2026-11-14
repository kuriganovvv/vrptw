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
import ru.sibsutis.vrptw_backend.web.storage.DataStore;

/**
 * Дополнительные методы для интерфейса диспетчера.
 *
 * Контракт организаторов (api_spec.yaml) не описывает чтение справочников и дня,
 * но разрешает дополнительные эндпоинты под другими путями, поэтому UI берёт
 * исходные данные отсюда, а не из собственных моков.
 */
@RestController
@RequestMapping("/api/v1/ui")
public class UiController {

    private final DataStore store;
    private final PlanningService planning;

    public UiController(DataStore store, PlanningService planning) {
        this.store = store;
        this.planning = planning;
    }

    /** Список загруженных дней: интерфейс выбирает последний, а не захардкоженную дату. */
    @GetMapping("/days")
    public List<UiDay> days() {
        return store.loadedDates().stream()
                .sorted()
                .map(date -> new UiDay(date, store.now(date)))
                .toList();
    }

    /** Наряды дня с учётом принятых событий (новые, отменённые, выбывшие сотрудники). */
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
