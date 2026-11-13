package ru.sibsutis.vrptw_backend.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.cfg.DateTimeFeature;

/**
 * Без этого Jackson 3 приводит OffsetDateTime к UTC, и смена «09:00» применяется
 * к UTC, а не к местному смещению из запроса (+05:00) — маршрут уезжает на 5 часов.
 * Смещение из JSON должно сохраняться: по нему считаются смены и окна СЦ.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public JsonMapperBuilderCustomizer preserveDateTimeOffsets() {
        return builder -> builder.disable(DateTimeFeature.ADJUST_DATES_TO_CONTEXT_TIME_ZONE);
    }
}
