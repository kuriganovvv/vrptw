package ru.sibsutis.vrptw_backend.domain.model;

import java.time.LocalTime;

public record ServiceCenter(
        String serviceCenterId,
        String name,
        String address,
        double lat,
        double lon,
        LocalTime openingFrom,
        LocalTime openingTo,
        int restockDurationMin) {
}
