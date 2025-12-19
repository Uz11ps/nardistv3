#!/bin/bash

# Скрипт для диагностики и исправления проблем с backend

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"

echo "🔍 Диагностика проблем с backend..."

ssh $SERVER << ENDSSH
cd $SERVER_PATH

echo "📝 Логи backend (последние 100 строк):"
docker-compose logs --tail=100 backend

echo ""
echo "🔍 Проверка структуры dist:"
docker-compose exec backend ls -la /app/dist/ || echo "Контейнер не запущен"

echo ""
echo "🔍 Проверка main.js:"
docker-compose exec backend cat /app/dist/main.js | head -20 || echo "Файл не найден"

echo ""
echo "📋 Переменные окружения (без секретов):"
docker-compose exec backend env | grep -E 'NODE_ENV|POSTGRES|REDIS|BACKEND_PORT|DOMAIN' || echo "Контейнер не запущен"

echo ""
echo "🔄 Попытка перезапуска с очисткой:"
docker-compose stop backend
docker-compose rm -f backend
docker-compose up -d backend

echo ""
echo "⏳ Ожидание запуска (10 секунд)..."
sleep 10

echo ""
echo "📊 Статус после перезапуска:"
docker-compose ps backend

echo ""
echo "📝 Последние логи после перезапуска:"
docker-compose logs --tail=50 backend
ENDSSH

