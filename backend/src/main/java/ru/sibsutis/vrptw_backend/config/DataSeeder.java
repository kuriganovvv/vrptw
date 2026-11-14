package ru.sibsutis.vrptw_backend.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
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
 * пересчитанные планы не теряются при рестарте. Исключение — файл в {@code data/}
 * изменился позже, чем запись в БД (например, после merge обновился набор
 * нарядов): тогда устаревшая запись заменяется, а план и события этой даты
 * сбрасываются. Данные, загруженные через API после изменения файлов, не
 * затрагиваются. Принудительно перечитать всё можно через
 * {@code VRPTW_SEED_FORCE=true}.
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
    private final boolean force;

    public DataSeeder(DataStore store, JsonMapper mapper,
                      @Value("${vrptw.data-dir:}") String configuredDir,
                      @Value("${vrptw.seed.force:false}") boolean force) {
        this.store = store;
        this.mapper = mapper;
        this.configuredDir = configuredDir;
        this.force = force;
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
        if (!Files.isRegularFile(file)) {
            return;
        }
        boolean exists = store.findReference().isPresent();
        if (exists && !shouldReplace(file, store.referenceUpdatedAt())) {
            return;
        }
        store.saveReference(read(file, ReferenceData.class));
        log.info("{} справочник из {}", exists ? "Обновлён" : "Загружен", file);
    }

    private void seedTravelMatrix(Path dir) throws IOException {
        Path file = dir.resolve(MATRIX_FILE);
        if (!Files.isRegularFile(file)) {
            return;
        }
        boolean exists = store.findTravelMatrix().isPresent();
        if (exists && !shouldReplace(file, store.travelMatrixUpdatedAt())) {
            return;
        }
        store.saveTravelMatrix(read(file, TravelMatrix.class));
        log.info("{} матрица перемещений из {}", exists ? "Обновлена" : "Загружена", file);
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
            boolean exists = store.findDay(day.date()).isPresent();
            if (exists && !shouldReplace(file, store.dayUpdatedAt(day.date()))) {
                continue;
            }
            store.saveDay(day.date(), day);
            log.info("{} день {} из {}", exists ? "Обновлён" : "Загружен", day.date(), file);
        }
    }

    /**
     * Данные из {@code data/} перезаписывают БД, только если файл новее записи
     * в БД (или включён {@code VRPTW_SEED_FORCE}). Так обновления из репозитория
     * подхватываются автоматически, а данные, загруженные через API, не теряются.
     */
    private boolean shouldReplace(Path file, Optional<OffsetDateTime> savedAt) {
        if (force) {
            return true;
        }
        if (savedAt.isEmpty()) {
            return false;
        }
        try {
            FileTime modified = Files.getLastModifiedTime(file);
            return modified.toInstant().isAfter(savedAt.get().toInstant());
        } catch (IOException e) {
            log.warn("Не удалось прочитать время изменения {}", file, e);
            return false;
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
