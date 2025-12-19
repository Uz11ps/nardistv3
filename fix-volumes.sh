#!/bin/bash

echo "🔧 Исправление volumes в docker-compose.yml..."

cd /var/www/nardiphp

# Убираем volume который перезаписывает /app
sed -i '/- \.\/backend:\/app/d' docker-compose.yml
sed -i '/- \.\/frontend:\/app/d' docker-compose.yml

echo "✅ Volumes исправлены"
echo "Перезапускаем контейнеры..."
docker-compose down
docker-compose up -d

echo "Проверяем dist..."
sleep 5
docker-compose exec backend ls -la /app/dist/

