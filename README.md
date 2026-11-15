# Установка и запуск

Сервис планирования выездных работ (VRPTW). Состоит из backend на Spring Boot
и frontend на Angular; в Docker оба контейнера поднимаются через `docker compose`.

## Требования

- Docker 24+ и Docker Compose v2 — для запуска в контейнерах.
- JDK 21 — для локального запуска backend.
- Node.js 20.19+ / 22.12+ и npm 10+ — для локального запуска frontend.

## Запуск в Docker

```bash
git clone https://github.com/kuriganovvv/vrptw.git
cd vrptw
docker compose up --build -d
```

Проверить, что сервис поднялся:

```bash
docker compose ps
curl http://localhost:8080/api/v1/health
```

- Веб-интерфейс диспетчера: <http://localhost>
- REST API: <http://localhost:8080/api/v1>

Остановка:

```bash
docker compose down
```


## Локальный запуск

Backend:

```bash
cd backend
./gradlew bootRun          # Windows: gradlew.bat bootRun
```

Frontend (в отдельном терминале):

```bash
cd frontend
npm ci
npm start                  # http://localhost:4200, /api проксируется на :8080
```

Production-сборка frontend: `npm run build`.

## Разделы интерфейса

- `/dashboard` — карта и сводка;
- `/orders` — наряды дня;
- `/staff` — сотрудники;
- `/analytics` — метрики смены;
- `/field` — мобильный интерфейс бригады: навигация к следующему адресу и отметки
  о звонке абоненту, прибытии и завершении визита;
- `/scenarios` — сценарный анализ: «что если на смену выйдет меньше сотрудников»
  и «какой запас АО нужен, чтобы не заезжать в СЦ».

## Сценарный анализ

Дополнительный эндпоинт считает гипотетический план, не меняя рабочий план дня:

```bash
curl -s -X POST http://localhost:8080/api/v1/days/2026-10-26/scenarios \
  -H 'Content-Type: application/json' \
  -d '{"staff_delta": -3, "time_limit_sec": 5}'
```

Ответ содержит метрики базового и сценарного планов, новые нераспределённые
наряды с причинами и рекомендацию по запасу АО в рюкзаке. Подробности —
в [docs/scenario-analysis.md](docs/scenario-analysis.md).

## Backend и PostgreSQL

Состояние сервиса (справочники, матрица, наряды дня, планы, события и их эффекты)
хранится в PostgreSQL. Схема создаётся автоматически при старте приложения
(`backend/src/main/resources/schema.sql`).

При первом запуске пустая БД автоматически заполняется файлами из `data/`
(`reference.json`, `travel_matrix.json`, `day_*.json`). Уже загруженные данные
не перезаписываются, поэтому события и построенные планы сохраняются при
рестарте.

Если файл в `data/` изменился позже, чем запись в БД (например, после `git pull`
обновился набор нарядов), автозагрузка заменит устаревшую запись и сбросит план
и события этой даты. Данные, загруженные через API уже после изменения файлов,
не затрагиваются. Принудительно перечитать всё:

```bash
VRPTW_SEED_FORCE=true docker compose up -d backend
```

Каталог можно задать через `VRPTW_DATA_DIR`, а автозагрузку отключить через
`VRPTW_SEED_ENABLED=false`.

По умолчанию backend подключается к `jdbc:postgresql://localhost:5432/vrptw`
(пользователь/пароль `vrptw`/`vrptw`). Параметры переопределяются переменными
окружения:

```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/vrptw
SPRING_DATASOURCE_USERNAME=vrptw
SPRING_DATASOURCE_PASSWORD=vrptw
```

Запуск всего стека (PostgreSQL + backend + frontend):

```bash
docker compose up --build
```

Только база для локальной разработки:

```bash
docker compose up -d postgres
cd backend
./gradlew bootRun        # http://localhost:8080
```

Если PostgreSQL недоступен, для отладки можно вернуться к in-memory хранилищу:

```bash
VRPTW_STORAGE_MODE=memory ./gradlew bootRun
```

## Проверки

```bash
cd backend && ./gradlew test
cd frontend && npm run build
cd frontend && npm test -- --watch=false
```
