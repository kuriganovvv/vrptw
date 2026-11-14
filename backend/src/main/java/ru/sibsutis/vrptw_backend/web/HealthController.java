package ru.sibsutis.vrptw_backend.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import ru.sibsutis.vrptw_backend.dto.common.Health;

@RestController
public class HealthController {

    private final String team;
    private final String version;

    public HealthController(@Value("${dispatch.team}") String team,
                            @Value("${dispatch.version}") String version) {
        this.team = team;
        this.version = version;
    }

    @GetMapping("/api/v1/health")
    public Health health() {
        return new Health("ok", team, version);
    }
}