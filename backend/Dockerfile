# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# По умолчанию берём официальный URL, но в compose подставляется быстрый mirror:
# сеть до services.gradle.org может быть сильно ограничена.
ARG GRADLE_DISTRIBUTION_URL=https://services.gradle.org/distributions/gradle-9.8.2-bin.zip

COPY gradlew .
COPY gradle ./gradle
COPY build.gradle .
COPY settings.gradle .

RUN chmod +x gradlew \
    && sed -i "s|^distributionUrl=.*|distributionUrl=${GRADLE_DISTRIBUTION_URL}|" gradle/wrapper/gradle-wrapper.properties

# Gradle distribution и зависимости скачиваются один раз и кэшируются между сборками
RUN --mount=type=cache,target=/root/.gradle ./gradlew dependencies --no-daemon

COPY src ./src
RUN --mount=type=cache,target=/root/.gradle ./gradlew bootJar --no-daemon


FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
