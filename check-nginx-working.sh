#!/bin/bash

# Скрипт для проверки работы Nginx и frontend

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔍 Проверка работы Nginx и frontend..."
echo ""

# Проверяем что frontend контейнер работает
echo "1. Проверка frontend контейнера:"
if curl -s http://127.0.0.1:5173 > /dev/null 2>&1; then
    echo "✅ Frontend контейнер отвечает на порту 5173"
    curl -s http://127.0.0.1:5173 | head -5
else
    echo "❌ Frontend контейнер НЕ отвечает на порту 5173"
    echo "Проверьте: docker-compose ps frontend"
fi

echo ""
echo "2. Проверка location / в конфигурации:"
grep -A 15 "location / {" "$CONFIG_FILE" | head -20

echo ""
echo "3. Проверка что location / проксирует на правильный порт:"
PROXY_PASS=$(grep -A 15 "location / {" "$CONFIG_FILE" | grep "proxy_pass" | head -1)
echo "$PROXY_PASS"

if echo "$PROXY_PASS" | grep -q "127.0.0.1:5173"; then
    echo "✅ location / проксирует на порт 5173 (правильно)"
else
    echo "❌ location / НЕ проксирует на порт 5173!"
    echo "Текущее значение: $PROXY_PASS"
fi

echo ""
echo "4. Проверка через Nginx:"
echo "Запрос к http://nardist.site:"
curl -s http://nardist.site | head -10

echo ""
echo "5. Проверка API:"
curl -s http://nardist.site/api/health

echo ""
echo "6. Статус контейнеров:"
docker-compose ps

