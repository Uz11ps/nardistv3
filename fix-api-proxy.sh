#!/bin/bash

# Скрипт для проверки и исправления проксирования API

echo "🔍 Проверка проксирования API..."

echo ""
echo "📝 Шаг 1: Проверка доступности backend..."
curl -s http://127.0.0.1:3000/health || echo "❌ Backend недоступен на localhost:3000"

echo ""
echo "📝 Шаг 2: Проверка конфигурации location /api..."
grep -A 10 "location /api" /etc/nginx/vhosts/www-root/nardist.site.conf

echo ""
echo "📝 Шаг 3: Проверка через домен..."
curl -v http://nardist.site/api/health 2>&1 | head -20

echo ""
echo "📝 Шаг 4: Проверка что backend работает..."
docker-compose ps backend

echo ""
echo "📝 Шаг 5: Проверка логов backend..."
docker-compose logs --tail=10 backend

echo ""
echo "Если backend работает, но API не отвечает, возможно нужно исправить proxy_pass в location /api"

