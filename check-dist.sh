#!/bin/bash

echo "🔍 Проверка содержимого dist в контейнере..."

docker-compose exec backend ls -la /app/dist/ || echo "Контейнер не запущен"

echo ""
echo "🔍 Проверка сборки в builder образе..."
docker run --rm nardiphp-backend:latest ls -la /app/dist/ || echo "Образ не найден"

