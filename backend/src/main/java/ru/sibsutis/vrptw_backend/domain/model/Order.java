package ru.sibsutis.vrptw_backend.domain.model;

import ru.sibsutis.vrptw_backend.domain.enums.WorkTypeCode;
import ru.sibsutis.vrptw_backend.domain.enums.Technology;
import ru.sibsutis.vrptw_backend.domain.enums.BuildingType;

import java.time.OffsetDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    private String orderId;
    private WorkTypeCode workTypeCode;
    private Technology technology;
    private String buildingId;
    private String address;
    private double lat;
    private double lon;
    private BuildingType buildingType;
    private boolean requiresHeight;
    private String accessNodeId;
    private OffsetDateTime registeredAt;
    private OffsetDateTime slotStart;
    private OffsetDateTime slotEnd;
    private OffsetDateTime latestStart;
    private OffsetDateTime deadline;
    private Equipment requiredEquipment;
    private boolean isRepeat;
    private String previousOrderId;
}
