#!/bin/bash

# Упрощенный скрипт для быстрого деплоя

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"

echo "🚀 Быстрый деплой обновлений..."

# Загрузка файлов
echo "📤 Загрузка файлов..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'build' \
    --exclude '.env' \
    --exclude '*.log' \
    --exclude '.git' \
    ./ $SERVER:$SERVER_PATH/

# Пересборка на сервере
echo "🔨 Пересборка на сервере..."
ssh $SERVER "cd $SERVER_PATH && docker-compose down && docker-compose build --no-cache backend frontend && docker-compose up -d"

echo "✅ Готово!"

