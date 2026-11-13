package ru.sibsutis.vrptw_backend.dto.common;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record LoadResult(String status, Map<String, Integer> counts) {
}
