# vrptw
Репозиторий для кейса №5 всероссийского хакатона связи.

## 🖥️ Frontend

Интерфейс диспетчера: карта маршрутов, сотрудники на смене, проблемы (риски / не назначено / ПГП), диаграмма Ганта и наряды дня.

- Angular 22, standalone-компоненты, signals
- Tailwind CSS 4, Leaflet + OpenStreetMap
- Демо-данные включены: приложение работает без backend. Кнопка проверки API в шапке подключается к `/api` на `http://localhost:8080` и загружает построенный план.

```bash
cd frontend
npm install
npm start        # http://localhost:4200, /api проксируется на localhost:8080
npm run build    # production-сборка в dist/frontend/browser
```

Требуется Node.js 20.19+ / 22.12+ и npm 10+.

## 🗄️ Backend и PostgreSQL

Состояние сервиса (справочники, матрица, наряды дня, планы, события и их эффекты)
хранится в PostgreSQL. Схема создаётся автоматически при старте приложения
(`backend/src/main/resources/schema.sql`).

При первом запуске пустая БД автоматически заполняется файлами из `data/`
(`reference.json`, `travel_matrix.json`, `day_*.json`). Уже загруженные данные
не перезаписываются. Каталог можно задать через `VRPTW_DATA_DIR`, а автозагрузку
отключить через `VRPTW_SEED_ENABLED=false`.

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

## 📖 Документация

- [Гайд: Совместная работа в Excalidraw](https://github.com/kuriganovvv/vrptw/blob/0b641a5ce43e040f034115426cae903714d519f8/wiki/Excalidraw.md)
- [Совместная работа в репозитории](https://github.com/kuriganovvv/vrptw/blob/0b641a5ce43e040f034115426cae903714d519f8/wiki/meta.md)
