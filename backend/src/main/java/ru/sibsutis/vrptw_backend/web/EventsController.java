package ru.sibsutis.vrptw_backend.web;

import java.time.LocalDate;
import java.util.Map;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import ru.sibsutis.vrptw_backend.dto.event.EventResult;
import ru.sibsutis.vrptw_backend.web.events.EventProcessor;

@RestController
@RequestMapping("/api/v1/days/{date}/events")
public class EventsController {

    private final EventProcessor processor;

    public EventsController(EventProcessor processor) { this.processor = processor; }

    @PostMapping
    public ResponseEntity<EventResult> accept(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestBody Map<String, Object> event) {
        return ResponseEntity.ok(processor.process(date, event));
    }
}