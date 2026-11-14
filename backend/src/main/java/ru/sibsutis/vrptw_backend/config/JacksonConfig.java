package ru.sibsutis.vrptw_backend.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.cfg.DateTimeFeature;


@Configuration
public class JacksonConfig {

    @Bean
    public JsonMapperBuilderCustomizer preserveDateTimeOffsets() {
        return builder -> builder.disable(DateTimeFeature.ADJUST_DATES_TO_CONTEXT_TIME_ZONE);
    }
}
