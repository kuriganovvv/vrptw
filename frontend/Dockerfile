# Сборка SPA
FROM node:22-alpine AS build
WORKDIR /app

# Сначала только манифесты — слой с зависимостями кэшируется между сборками
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Раздача статики и проксирование API на backend
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD wget --spider -q http://localhost/ || exit 1
