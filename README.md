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

## Загрузка данных

По контракту данные загружаются через API. Команды выполняются из корня репозитория
(Linux/macOS или Git Bash; в PowerShell используйте `curl.exe`):

```bash
# Справочники
curl -X PUT http://localhost:8080/api/v1/reference \
     -H 'Content-Type: application/json' \
     --data-binary @data/reference.json

# Матрица времени в пути
curl -X PUT http://localhost:8080/api/v1/reference/travel-matrix \
     -H 'Content-Type: application/json' \
     --data-binary @data/travel_matrix.json

# Наряды дня
curl -X PUT http://localhost:8080/api/v1/days/2026-10-26 \
     -H 'Content-Type: application/json' \
     --data-binary @data/day_2026-10-26.json

# Построение плана
curl -X POST http://localhost:8080/api/v1/days/2026-10-26/plan
```

После загрузки дня интерфейс на <http://localhost> возьмёт справочники, наряды
и план из сервиса. Пока данные не загружены, интерфейс показывает демо-данные.

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

Разделы интерфейса диспетчера: `/dashboard` — карта и сводка, `/orders` — наряды дня,
`/staff` — сотрудники, `/analytics` — метрики смены. Раздел `/field` — мобильный
интерфейс бригады: навигация к следующему адресу и отметки о звонке абоненту,
прибытии и завершении визита.

## Проверки

```bash
cd backend && ./gradlew test
cd frontend && npm run build
cd frontend && npm test -- --watch=false
```
