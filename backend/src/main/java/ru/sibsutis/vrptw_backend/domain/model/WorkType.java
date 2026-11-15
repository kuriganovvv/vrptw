package ru.sibsutis.vrptw_backend.domain.model;

import ru.sibsutis.vrptw_backend.domain.enums.WorkTypeCode;
import ru.sibsutis.vrptw_backend.domain.enums.Profile;

import java.util.Set;

public record WorkType(
        WorkTypeCode code,
        String name,
        Set<Profile> profiles,
        int durationMin,
        Integer maxStartDelayMin,
        boolean pgpRelevant,
        boolean joint
) {}
