package ru.sibsutis.vrptw_backend.dto.common;

import java.util.List;

/** Тело ошибки строго по схеме ErrorResponse из api_spec.yaml. */
public record ErrorResponse(Error error) {

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(new Error(code, message, List.of()));
    }

    public static ErrorResponse of(String code, String message, List<Detail> details) {
        return new ErrorResponse(new Error(code, message, details));
    }

    public record Error(String code, String message, List<Detail> details) {
    }

    public record Detail(String field, String message) {
    }
}
