package ru.sibsutis.vrptw_backend.service;

/** Данные корректны по схеме, но противоречат справочникам — 422 по спецификации. */
public class DataMappingException extends RuntimeException {

    public DataMappingException(String message) {
        super(message);
    }
}
