#!/bin/bash

# Скрипт для проверки деплоя

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"

echo "🔍 Проверка деплоя..."

ssh $SERVER << ENDSSH
cd $SERVER_PATH

echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "📝 Логи backend (последние 30 строк):"
docker-compose logs --tail=30 backend

echo ""
echo "📝 Логи frontend (последние 30 строк):"
docker-compose logs --tail=30 frontend

echo ""
echo "🔍 Проверка здоровья сервисов:"
curl -s http://localhost:3000/health || echo "Backend не отвечает"
curl -s -I http://localhost:5173 | head -1 || echo "Frontend не отвечает"

echo ""
echo "✅ Проверка завершена!"
ENDSSH

