package ru.sibsutis.vrptw_backend.web.scenario;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ru.sibsutis.vrptw_backend.dto.scenario.ScenarioRequest;
import ru.sibsutis.vrptw_backend.dto.scenario.ScenarioResult;

/**
 * Сценарный анализ плана дня. Дополнительный эндпоинт вне контракта
 * организаторов: рабочий план и состояние дня не изменяются.
 */
@RestController
@RequestMapping("/api/v1/days/{date}/scenarios")
public class ScenarioController {

    private final ScenarioService scenarios;

    public ScenarioController(ScenarioService scenarios) {
        this.scenarios = scenarios;
    }

    @PostMapping
    public ScenarioResult analyze(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestBody(required = false) ScenarioRequest request) {
        return scenarios.analyze(date, request);
    }
}
