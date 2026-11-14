package ru.sibsutis.vrptw_backend.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import tools.jackson.databind.json.JsonMapper;

import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.TravelMatrix;
import ru.sibsutis.vrptw_backend.web.storage.DataStore;

/**
 * Загружает демонстрационные данные из каталога {@code data/} в пустую БД.
 *
 * Раньше сервис стартовал с пустым in-memory хранилищем и данные загружались
 * только через PUT-запросы. После перехода на PostgreSQL БД также стартует
 * пустой, поэтому UI показывает «день не загружен». Заполняем её теми же
 * JSON-файлами, которые лежат в репозитории и монтируются в контейнер.
 *
 * Уже загруженные сущности не перезаписываются, поэтому события и
 * пересчитанные планы не теряются при рестарте.
 */
@Component
@ConditionalOnProperty(name = "vrptw.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String REFERENCE_FILE = "reference.json";
    private static final String MATRIX_FILE = "travel_matrix.json";

    private final DataStore store;
    private final JsonMapper mapper;
    private final String configuredDir;

    public DataSeeder(DataStore store, JsonMapper mapper,
                      @Value("${vrptw.data-dir:}") String configuredDir) {
        this.store = store;
        this.mapper = mapper;
        this.configuredDir = configuredDir;
    }

    @Override
    public void run(ApplicationArguments args) {
        Path dir = resolveDataDir();
        if (dir == null) {
            log.info("Каталог с исходными данными не найден — автозагрузка пропущена");
            return;
        }
        try {
            seedReference(dir);
            seedTravelMatrix(dir);
            seedDays(dir);
        } catch (IOException e) {
            log.error("Не удалось загрузить исходные данные из {}", dir, e);
        }
    }

    private void seedReference(Path dir) throws IOException {
        Path file = dir.resolve(REFERENCE_FILE);
        if (store.findReference().isPresent() || !Files.isRegularFile(file)) {
            return;
        }
        store.saveReference(read(file, ReferenceData.class));
        log.info("Загружен справочник из {}", file);
    }

    private void seedTravelMatrix(Path dir) throws IOException {
        Path file = dir.resolve(MATRIX_FILE);
        if (store.findTravelMatrix().isPresent() || !Files.isRegularFile(file)) {
            return;
        }
        store.saveTravelMatrix(read(file, TravelMatrix.class));
        log.info("Загружена матрица перемещений из {}", file);
    }

    private void seedDays(Path dir) throws IOException {
        List<Path> files;
        try (Stream<Path> stream = Files.list(dir)) {
            files = stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().startsWith("day_"))
                    .filter(path -> path.getFileName().toString().endsWith(".json"))
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .toList();
        }
        for (Path file : files) {
            DayInput day = read(file, DayInput.class);
            if (day.date() == null) {
                log.warn("Пропускаю {}: в JSON не указана дата дня", file);
                continue;
            }
            if (store.findDay(day.date()).isPresent()) {
                continue;
            }
            store.saveDay(day.date(), day);
            log.info("Загружен день {} из {}", day.date(), file);
        }
    }

    private <T> T read(Path file, Class<T> type) throws IOException {
        return mapper.readValue(Files.readString(file), type);
    }

    private Path resolveDataDir() {
        if (configuredDir != null && !configuredDir.isBlank()) {
            Path configured = Path.of(configuredDir).toAbsolutePath().normalize();
            return Files.isDirectory(configured) ? configured : null;
        }
        for (String candidate : List.of("data", "../data")) {
            Path path = Path.of(candidate).toAbsolutePath().normalize();
            if (Files.isRegularFile(path.resolve(REFERENCE_FILE))) {
                return path;
            }
        }
        return null;
    }
}
