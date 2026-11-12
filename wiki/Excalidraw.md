# Совместная работа в Excalidraw

Этот гайд описывает, как настроить общую доску (Obsidian + Excalidraw + Live Sync) для работы над кейсом VRPTW. 
Мы используем **Tailscale** для связи между устройствами (Windows и Mac).
## Зачем вообще надо 
Веб-версия Excalidraw не дает открывать произвольные ссылки, а также ограничено по облачному хранилищу.
Обсидиан версия куда прокаченней, есть latex, ссылки открываются, можно md файлы встраивать.

Картинок много, а доска одна. Excalidraw, Хакатон, Победа!

## 1. Что нужно установить (каждому участнику)

1. **Obsidian** — [скачать здесь](https://obsidian.md/) (бесплатно, Windows/Mac/Linux, 1.15.0 версия).
Если пользуетесь впервые, то обязательно создать хранилище(удобно на рабочем столе).
<img width="698" height="799" alt="image" src="https://github.com/user-attachments/assets/1c29cbb3-ee51-420a-9f6b-e8b8ffe18be6" />

2. **Плагин Excalidraw** — в Obsidian: `Settings/Ctrl+Б` → `Community plugins` → `Browse` → найти `Excalidraw` → `Install` → `Enable`.

3. **Плагин Excalidraw Live Sync** (через BRAT):
   - В том же меню плагинов найти `BRAT` → `Install` → `Enable`.
   - Открыть настройки BRAT → `Add Beta plugin` → ввести `https://github.com/shenid1/excalidraw-live-sync` → `Add`.
   - В списке плагинов включить `Excalidraw Live Sync`.
4. **Tailscale** — [скачать здесь](https://tailscale.com/download) (бесплатно, если не открывается, то используйте Zапрет~ные ниндзюцу~).
   - Установить, войти через Google/GitHub/Apple.
   - Запросить ссылку у меня через тг.

## 2. Как запустить сессию(Только для хоста, пропустить)

1. Открыть Obsidian, создать новый холст Excalidraw (или открыть существующий).
2. Нажать `Ctrl/Cmd + P` (панель команд) → ввести `Excalidraw Live Sync: Start live session (host)`.
3. Скопировать **IP-адрес Tailscale** (он будет начинаться на `100.x.x.x`).
4. Скопировать **пароль сессии** .
5. Отправить IP и пароль в общий чат команды.

## 3. Как подключиться (Остальные участники)

1. Открыть Obsidian, создать/открыть холст Excalidraw.
2. Нажать `Ctrl/Cmd + P` → `Excalidraw Live Sync: Join live session`.
3. Ввести **IP-адрес хоста**(`100.91.8.104:47321`), **пароль**(нету) и свое имя.
4. Выбрать «присоединиться к доске хоста» или «создать новую доску».