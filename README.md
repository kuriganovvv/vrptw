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

## 📖 Документация

- [Гайд: Совместная работа в Excalidraw](https://github.com/kuriganovvv/vrptw/blob/0b641a5ce43e040f034115426cae903714d519f8/wiki/Excalidraw.md)
- [Совместная работа в репозитории](https://github.com/kuriganovvv/vrptw/blob/0b641a5ce43e040f034115426cae903714d519f8/wiki/meta.md)
