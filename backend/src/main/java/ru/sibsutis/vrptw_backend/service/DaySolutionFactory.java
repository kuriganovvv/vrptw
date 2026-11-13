package ru.sibsutis.vrptw_backend.service;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import ru.sibsutis.vrptw_backend.domain.enums.BuildingType;
import ru.sibsutis.vrptw_backend.domain.model.DaySolution;
import ru.sibsutis.vrptw_backend.domain.model.Equipment;
import ru.sibsutis.vrptw_backend.domain.model.Order;
import ru.sibsutis.vrptw_backend.domain.enums.Profile;
import ru.sibsutis.vrptw_backend.domain.model.ServiceCenter;
import ru.sibsutis.vrptw_backend.domain.model.Shift;
import ru.sibsutis.vrptw_backend.domain.model.Staff;
import ru.sibsutis.vrptw_backend.domain.enums.Technology;
import ru.sibsutis.vrptw_backend.domain.model.TravelMatrix;
import ru.sibsutis.vrptw_backend.domain.model.Visit;
import ru.sibsutis.vrptw_backend.domain.model.WorkType;
import ru.sibsutis.vrptw_backend.domain.enums.WorkTypeCode;
import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;

/** Единственная точка сборки доменной модели из DTO — контракт для контроллеров. */
public class DaySolutionFactory {

    public DaySolution build(ReferenceData reference, DayInput day, ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix matrixDto) {
        if (reference == null) {
            throw new DataMappingException("Справочники не загружены");
        }
        if (day == null || day.date() == null || day.now() == null) {
            throw new DataMappingException("В DayInput обязательны date и now");
        }
        if (matrixDto == null || matrixDto.points() == null) {
            throw new DataMappingException("Матрица времени в пути не загружена");
        }

        TravelMatrix matrix;
        try {
            matrix = new TravelMatrix(matrixDto.matrixId(), matrixDto.points(),
                    matrixDto.durationsSec(), matrixDto.distancesM());
        } catch (RuntimeException exception) {
            throw new DataMappingException("Некорректная матрица времени в пути: " + exception.getMessage());
        }

        Map<WorkTypeCode, WorkType> workTypes = mapWorkTypes(reference);
        List<ServiceCenter> serviceCenters = mapServiceCenters(reference);

        Set<String> absent = day.absentStaffIds() == null
                ? Set.of()
                : new LinkedHashSet<>(day.absentStaffIds());

        List<Staff> staff = mapStaff(reference, matrix, absent);
        List<Visit> visits = mapVisits(day, workTypes);

        return new DaySolution(day.date(), day.now(), new ArrayList<>(visits), new ArrayList<>(staff),
                new ArrayList<>(workTypes.values()), serviceCenters, matrix);
    }

    private List<ServiceCenter> mapServiceCenters(ReferenceData reference) {
        List<ServiceCenter> result = new ArrayList<>();
        if (reference.serviceCenters() == null) {
            return result;
        }
        for (var center : reference.serviceCenters()) {
            LocalTime open = center.openingHours() == null ? null : center.openingHours().open();
            LocalTime close = center.openingHours() == null ? null : center.openingHours().close();
            result.add(new ServiceCenter(center.serviceCenterId(), center.name(), center.address(),
                    center.lat(), center.lon(), open, close, center.restockDurationMin()));
        }
        return result;
    }

    private Map<WorkTypeCode, WorkType> mapWorkTypes(ReferenceData reference) {
        Map<WorkTypeCode, WorkType> result = new LinkedHashMap<>();
        if (reference.workTypes() == null) {
            return result;
        }
        for (var workType : reference.workTypes()) {
            WorkTypeCode code = parseEnum(WorkTypeCode.class, workType.code(), "work_type.code");
            Set<Profile> profiles = new LinkedHashSet<>();
            for (String profile : workType.profiles()) {
                profiles.add(parseEnum(Profile.class, profile, "work_type.profiles"));
            }
            result.put(code, new WorkType(code, workType.name(), profiles,
                    workType.durationMin(), workType.maxStartDelayMin(), workType.pgpRelevant()));
        }
        if (result.isEmpty()) {
            throw new DataMappingException("Справочник типов работ пуст");
        }
        return result;
    }

    private List<Staff> mapStaff(ReferenceData reference, TravelMatrix matrix, Set<String> absent) {
        List<Staff> result = new ArrayList<>();
        if (reference.staff() == null) {
            return result;
        }
        for (var staffDto : reference.staff()) {
            if (absent.contains(staffDto.staffId())) {
                continue;
            }
            Set<Profile> profiles = new LinkedHashSet<>();
            for (String profile : staffDto.profiles()) {
                profiles.add(parseEnum(Profile.class, profile, "staff.profiles"));
            }
            Set<Technology> technologies = new LinkedHashSet<>();
            for (String technology : staffDto.technologies()) {
                technologies.add(parseEnum(Technology.class, technology, "staff.technologies"));
            }
            var shiftDto = staffDto.shift();
            if (shiftDto == null || shiftDto.breakWindow() == null) {
                throw new DataMappingException("У сотрудника " + staffDto.staffId() + " не задана смена");
            }
            Shift shift = new Shift(shiftDto.start(), shiftDto.end(), shiftDto.breakDurationMin(),
                    shiftDto.breakWindow().from(), shiftDto.breakWindow().to());

            Staff staff = new Staff(staffDto.staffId(), staffDto.serviceCenterId(), profiles, technologies,
                    staffDto.heightPermit(), shift,
                    equipment(staffDto.equipmentStart()), equipment(staffDto.equipmentCapacity()));
            staff.setDisplayName(staffDto.displayName());
            staff.setExperienceYears(staffDto.experienceYears() == null ? 0 : staffDto.experienceYears());
            staff.setTravelMatrix(matrix);
            result.add(staff);
        }
        if (result.isEmpty()) {
            throw new DataMappingException("Нет ни одного сотрудника на смене");
        }
        return result;
    }

    private List<Visit> mapVisits(DayInput day, Map<WorkTypeCode, WorkType> workTypes) {
        List<Visit> result = new ArrayList<>();
        if (day.orders() == null) {
            return result;
        }
        for (var orderDto : day.orders()) {
            WorkTypeCode code = parseEnum(WorkTypeCode.class, orderDto.workTypeCode(), "order.work_type_code");
            WorkType workType = workTypes.get(code);
            if (workType == null) {
                throw new DataMappingException("Неизвестный тип работ " + orderDto.workTypeCode()
                        + " у наряда " + orderDto.orderId());
            }
            if (orderDto.slot() == null || orderDto.slot().start() == null || orderDto.slot().end() == null) {
                throw new DataMappingException("У наряда " + orderDto.orderId() + " не задан слот");
            }

            Order order = Order.builder()
                    .orderId(orderDto.orderId())
                    .workTypeCode(code)
                    .technology(parseEnum(Technology.class, orderDto.technology(), "order.technology"))
                    .buildingId(orderDto.buildingId())
                    .address(orderDto.address())
                    .lat(orderDto.lat())
                    .lon(orderDto.lon())
                    .buildingType(parseEnum(BuildingType.class, orderDto.buildingType(), "order.building_type"))
                    .requiresHeight(orderDto.requiresHeight())
                    .accessNodeId(orderDto.accessNodeId())
                    .registeredAt(orderDto.registeredAt())
                    .slotStart(orderDto.slot().start())
                    .slotEnd(orderDto.slot().end())
                    .latestStart(orderDto.latestStart())
                    .deadline(orderDto.deadline())
                    .requiredEquipment(equipment(orderDto.requiredEquipment()))
                    .isRepeat(orderDto.isRepeat())
                    .previousOrderId(orderDto.previousOrderId())
                    .build();

            result.add(new Visit(order, workType));
        }
        return result;
    }

    private Equipment equipment(ru.sibsutis.vrptw_backend.dto.common.Equipment dto) {
        if (dto == null) {
            return Equipment.ZERO;
        }
        return Equipment.of(dto.ont(), dto.router(), dto.stb());
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String value, String field) {
        if (value == null) {
            throw new DataMappingException("Поле " + field + " обязательно");
        }
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException exception) {
            throw new DataMappingException("Неизвестное значение " + field + ": " + value);
        }
    }
}
