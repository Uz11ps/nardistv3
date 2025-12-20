FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Устанавливаем переменные окружения для build
ARG VITE_API_URL=https://nardist.site/api
ARG VITE_WS_URL=wss://nardist.site
ARG VITE_TELEGRAM_BOT_NAME

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_TELEGRAM_BOT_NAME=$VITE_TELEGRAM_BOT_NAME

RUN npm run build

FROM nginx:alpine

# Копируем собранные файлы в временную директорию
COPY --from=builder /app/dist /tmp/dist
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Скрипт для копирования файлов в volume при запуске
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'cp -r /tmp/dist/* /usr/share/nginx/html/ || true' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

EXPOSE 5173

CMD ["/docker-entrypoint.sh"]

