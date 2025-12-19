#!/bin/bash

echo "🔍 Проверка статуса контейнеров..."
docker-compose ps

echo ""
echo "📋 Логи backend (последние 50 строк):"
docker-compose logs --tail=50 backend

echo ""
echo "📋 Логи frontend (последние 50 строк):"
docker-compose logs --tail=50 frontend

echo ""
echo "🌐 Проверка доступности:"
echo "  Backend: curl http://localhost:3000/health"
curl -s http://localhost:3000/health || echo "Backend не отвечает"
echo ""
echo "  Frontend: curl http://localhost:5173"
curl -s -I http://localhost:5173 | head -1 || echo "Frontend не отвечает"

