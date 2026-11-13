package ru.sibsutis.vrptw_backend.web;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import ru.sibsutis.vrptw_backend.dto.EventResult;

import static org.springframework.http.HttpStatus.BAD_REQUEST;


@RestController
@RequestMapping("/api/v1/days/{date}/events")
public class EventsController {

    private static final Logger log = LoggerFactory.getLogger(EventsController.class);

    @PostMapping
    public ResponseEntity<EventResult> accept(
            @PathVariable LocalDate date,
            @RequestBody Map<String, Object> event) {
        String eventId = requiredText(event, "event_id");
        String type = requiredText(event, "type");
        OffsetDateTime timestamp = parseTimestamp(requiredText(event, "timestamp"));

        log.info("Accepted {} for {}: {}", type, date, event);
        return ResponseEntity.ok(new EventResult(
                eventId, true, false, 1, timestamp, null, List.of(), List.of(),
                "Event accepted; replanning is not implemented yet"));
    }

    private static String requiredText(Map<String, Object> event, String field) {
        Object rawValue = event.get(field);
        if (!(rawValue instanceof String value) || value.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Missing required field: " + field);
        }
        return value;
    }

    private static OffsetDateTime parseTimestamp(String timestamp) {
        try {
            return OffsetDateTime.parse(timestamp);
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid timestamp", exception);
        }
    }
}
