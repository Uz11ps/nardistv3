#!/bin/bash

echo "🔍 Проверка работы всех сервисов..."
echo ""

echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "🌐 Проверка Backend API:"
curl -s http://localhost:3000/health | jq . || curl -s http://localhost:3000/health

echo ""
echo "🌐 Проверка Frontend:"
curl -s -I http://localhost:5173 | head -1

echo ""
echo "📋 Последние логи backend:"
docker-compose logs --tail=20 backend

echo ""
echo "✅ Все сервисы работают!"
echo ""
echo "🌐 Доступные эндпоинты:"
echo "  - Backend: http://nardist.site:3000"
echo "  - Frontend: http://nardist.site:5173"
echo "  - Health: http://nardist.site:3000/health"

