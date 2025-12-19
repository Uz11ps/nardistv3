# Telegram Mini App "Нарды"

Полнофункциональное мини-приложение Telegram для игры в нарды.

## Установка

1. Клонируйте репозиторий
2. Скопируйте `.env.example` в `.env` и заполните переменные окружения
3. Запустите `docker-compose up -d`

## Деплой на сервер

См. `DEPLOY.md` для инструкций по деплою на ISPmanager 6.

## Структура проекта

- `backend/` - NestJS backend API
- `frontend/` - React + Vite frontend
- `docker-compose.yml` - Конфигурация Docker
- `deploy/` - Скрипты деплоя

