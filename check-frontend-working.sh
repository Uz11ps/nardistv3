#!/bin/bash

# Скрипт для проверки работы frontend и API

echo "🔍 Проверка работы frontend и API..."
echo ""

echo "1. Проверка API через HTTPS:"
curl -k -s https://nardist.site/api/health
echo ""

echo "2. Проверка WebSocket endpoint:"
curl -k -I https://nardist.site/socket.io/ 2>&1 | head -5
echo ""

echo "3. Проверка что backend работает:"
docker-compose ps backend
curl -s http://127.0.0.1:3000/health
echo ""

echo "4. Проверка логов backend на ошибки:"
docker-compose logs --tail=20 backend | grep -i error || echo "Ошибок не найдено"
echo ""

echo "5. Проверка логов frontend:"
docker-compose logs --tail=10 frontend
echo ""

echo "6. Проверка переменных окружения в frontend:"
docker-compose exec frontend env | grep VITE || echo "Переменные VITE не найдены (это нормально для production build)"
echo ""

echo "📝 Рекомендации:"
echo "- Откройте сайт в браузере и нажмите F12"
echo "- Проверьте вкладку Console на наличие ошибок"
echo "- Проверьте вкладку Network - загружаются ли все файлы"
echo "- Проверьте что вы открываете сайт через Telegram бота"

