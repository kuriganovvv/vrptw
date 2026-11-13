package ru.sibsutis.vrptw_backend.web;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import ru.sibsutis.vrptw_backend.dto.common.ErrorResponse;
import ru.sibsutis.vrptw_backend.service.DataMappingException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY;

/** Все ошибки — в формате ErrorResponse из api_spec.yaml. */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(DataMappingException.class)
    public ResponseEntity<ErrorResponse> handleMapping(DataMappingException exception) {
        return ResponseEntity.status(UNPROCESSABLE_ENTITY)
                .body(ErrorResponse.of("UNPROCESSABLE", exception.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException exception) {
        return ResponseEntity.status(BAD_REQUEST)
                .body(ErrorResponse.of("BAD_REQUEST", "Некорректный JSON или нарушение схемы"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleArgument(MethodArgumentTypeMismatchException exception) {
        return ResponseEntity.status(BAD_REQUEST)
                .body(ErrorResponse.of("BAD_REQUEST", "Некорректное значение параметра " + exception.getName()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleStatus(ResponseStatusException exception) {
        HttpStatusCode status = exception.getStatusCode();
        String reason = exception.getReason() == null ? "Ошибка запроса" : exception.getReason();
        return ResponseEntity.status(status).body(ErrorResponse.of(status.toString(), reason));
    }
}
