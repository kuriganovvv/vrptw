package ru.sibsutis.vrptw_backend.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import ru.sibsutis.vrptw_backend.dto.common.LoadResult;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;
import ru.sibsutis.vrptw_backend.web.storage.InMemoryDataStore;

@RestController
@RequestMapping("/api/v1")
public class ReferenceController {

    private final InMemoryDataStore store;

    public ReferenceController(InMemoryDataStore store) {
        this.store = store;
    }

    @PutMapping(path = "/reference", consumes = MediaType.APPLICATION_JSON_VALUE)
    public LoadResult putReference(@RequestBody ReferenceData body) {
        store.saveReference(body);
        Map<String, Integer> counts = new LinkedHashMap<>(); // TODO ключи counts сверить со спекой
        counts.put("service_centers", size(body.serviceCenters()));
        counts.put("staff", size(body.staff()));
        counts.put("access_nodes", size(body.accessNodes()));
        counts.put("work_types", size(body.workTypes()));
        return new LoadResult("loaded", counts);
    }

    @PutMapping(path = "/reference/travel-matrix", consumes = MediaType.APPLICATION_JSON_VALUE)
    public LoadResult putTravelMatrix(@RequestBody TravelMatrix body) {
        store.saveTravelMatrix(body);
        return new LoadResult("loaded", Map.of("points", size(body.points())));
    }

    private static int size(List<?> list) {
        return list == null ? 0 : list.size();
    }
}