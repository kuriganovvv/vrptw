package ru.sibsutis.vrptw_backend.web;

import java.time.LocalDate;
import java.util.Map;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import ru.sibsutis.vrptw_backend.dto.common.LoadResult;
import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.web.storage.DataStore;

@RestController
@RequestMapping("/api/v1/days")
public class DayController {

    private final DataStore store;

    public DayController(DataStore store) {
        this.store = store;
    }

    @PutMapping(path = "/{date}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public LoadResult putDay(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestBody DayInput body) {
        if (body.date() != null && !body.date().equals(date)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date в теле не совпадает с путём");
        }
        store.saveDay(date, body);
        return new LoadResult("loaded", Map.of("orders", body.orders() == null ? 0 : body.orders().size()));
    }
}