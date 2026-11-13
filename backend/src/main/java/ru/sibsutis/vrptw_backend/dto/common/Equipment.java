package ru.sibsutis.vrptw_backend.dto.common;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Количество абонентского оборудования из OpenAPI-схемы Equipment. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record Equipment(
        @JsonProperty("ONT") int ont,
        @JsonProperty("ROUTER") int router,
        @JsonProperty("STB") int stb) {
}
