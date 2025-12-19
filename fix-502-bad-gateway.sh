#!/bin/bash

# Скрипт для исправления 502 Bad Gateway

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Исправление 502 Bad Gateway..."
echo ""

# 1. Проверяем контейнеры
echo "1️⃣ Проверка Docker контейнеров..."
if docker ps | grep -q "nardi_backend"; then
    echo "   ✅ Backend контейнер запущен"
    BACKEND_STATUS=$(docker ps | grep "nardi_backend" | awk '{print $7}')
    echo "      Статус: $BACKEND_STATUS"
else
    echo "   ❌ Backend контейнер НЕ запущен!"
    echo "   Запускаю контейнер..."
    cd /var/www/nardiphp
    docker-compose up -d backend
    sleep 3
fi

if docker ps | grep -q "nardi_frontend"; then
    echo "   ✅ Frontend контейнер запущен"
    FRONTEND_STATUS=$(docker ps | grep "nardi_frontend" | awk '{print $7}')
    echo "      Статус: $FRONTEND_STATUS"
else
    echo "   ❌ Frontend контейнер НЕ запущен!"
    echo "   Запускаю контейнер..."
    cd /var/www/nardiphp
    docker-compose up -d frontend
    sleep 3
fi

echo ""

# 2. Проверяем доступность контейнеров
echo "2️⃣ Проверка доступности контейнеров из хоста..."

# Backend
echo "   Backend (localhost:3000):"
BACKEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>&1)
if [ "$BACKEND_TEST" = "200" ]; then
    echo "      ✅ Backend доступен (код: $BACKEND_TEST)"
    curl -s http://localhost:3000/health | head -1
else
    echo "      ❌ Backend НЕ доступен (код: $BACKEND_TEST)"
    echo "      Проверяю логи backend..."
    docker-compose logs --tail=10 backend 2>/dev/null | tail -5 | sed 's/^/         /'
fi

# Frontend
echo "   Frontend (localhost:5173):"
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "      ✅ Frontend доступен (код: $FRONTEND_TEST)"
else
    echo "      ❌ Frontend НЕ доступен (код: $FRONTEND_TEST)"
    echo "      Проверяю логи frontend..."
    docker-compose logs --tail=10 frontend 2>/dev/null | tail -5 | sed 's/^/         /'
fi

echo ""

# 3. Проверяем порты
echo "3️⃣ Проверка портов 3000 и 5173..."
if netstat -tlnp 2>/dev/null | grep -q ":3000" || ss -tlnp 2>/dev/null | grep -q ":3000"; then
    echo "   ✅ Порт 3000 слушается"
    netstat -tlnp 2>/dev/null | grep ":3000" | head -1 | sed 's/^/      /'
    ss -tlnp 2>/dev/null | grep ":3000" | head -1 | sed 's/^/      /'
else
    echo "   ❌ Порт 3000 НЕ слушается!"
    echo "   Backend контейнер не слушает порт 3000"
fi

if netstat -tlnp 2>/dev/null | grep -q ":5173" || ss -tlnp 2>/dev/null | grep -q ":5173"; then
    echo "   ✅ Порт 5173 слушается"
    netstat -tlnp 2>/dev/null | grep ":5173" | head -1 | sed 's/^/      /'
    ss -tlnp 2>/dev/null | grep ":5173" | head -1 | sed 's/^/      /'
else
    echo "   ❌ Порт 5173 НЕ слушается!"
    echo "   Frontend контейнер не слушает порт 5173"
fi

echo ""

# 4. Проверяем конфигурацию nginx - proxy_pass
echo "4️⃣ Проверка proxy_pass в конфигурации nginx..."

HTTPS_BLOCK_START=$(grep -n "listen.*443" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -n "$HTTPS_BLOCK_START" ]; then
    SERVER_START=$HTTPS_BLOCK_START
    while [ "$SERVER_START" -gt 0 ]; do
        if grep -q "^[[:space:]]*server {" <(sed -n "${SERVER_START}p" "$CONFIG_FILE" 2>/dev/null); then
            break
        fi
        SERVER_START=$((SERVER_START - 1))
    done
    
    SERVER_END=$SERVER_START
    INDENT=$(sed -n "${SERVER_START}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
    INDENT=$((INDENT - 1))
    
    TOTAL_LINES=$(wc -l < "$CONFIG_FILE")
    for i in $(seq $((SERVER_START + 1)) $TOTAL_LINES); do
        line=$(sed -n "${i}p" "$CONFIG_FILE")
        line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
        line_indent=$((line_indent - 1))
        
        if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
            SERVER_END=$i
            break
        fi
    done
    
    HTTPS_BLOCK=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")
    
    echo "   Проверка location /api:"
    API_PROXY=$(echo "$HTTPS_BLOCK" | grep -A 2 "location /api" | grep "proxy_pass")
    if echo "$API_PROXY" | grep -q "127.0.0.1:3000"; then
        echo "      ✅ Правильно: $API_PROXY" | sed 's/^/         /'
    else
        echo "      ❌ Неправильно: $API_PROXY" | sed 's/^/         /'
    fi
    
    echo "   Проверка location /:"
    ROOT_PROXY=$(echo "$HTTPS_BLOCK" | grep -A 2 "location /" | grep "proxy_pass" | head -1)
    if echo "$ROOT_PROXY" | grep -q "127.0.0.1:5173"; then
        echo "      ✅ Правильно: $ROOT_PROXY" | sed 's/^/         /'
    else
        echo "      ❌ Неправильно: $ROOT_PROXY" | sed 's/^/         /'
    fi
fi

echo ""

# 5. Проверяем логи nginx
echo "5️⃣ Проверка логов nginx для ошибок 502..."
ERROR_LOG="/var/log/nginx/error.log"
if [ -f "$ERROR_LOG" ]; then
    echo "   Последние ошибки 502:"
    tail -50 "$ERROR_LOG" | grep -i "502\|upstream\|connect" | tail -10 | sed 's/^/      /'
else
    echo "   ⚠️ Лог файл не найден: $ERROR_LOG"
fi

echo ""

# 6. Тестируем подключение nginx к контейнерам
echo "6️⃣ Тестирование подключения nginx к контейнерам..."

# Проверяем, может ли nginx подключиться к backend
echo "   Тест подключения к backend из nginx контекста:"
# Запускаем curl от имени nginx пользователя (обычно www-data)
if id www-data >/dev/null 2>&1; then
    sudo -u www-data curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>&1
    BACKEND_NGINX_TEST=$(sudo -u www-data curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>&1)
    if [ "$BACKEND_NGINX_TEST" = "200" ]; then
        echo "      ✅ Nginx может подключиться к backend"
    else
        echo "      ❌ Nginx НЕ может подключиться к backend (код: $BACKEND_NGINX_TEST)"
    fi
else
    echo "      ⚠️ Пользователь www-data не найден, пропускаю тест"
fi

echo ""

# 7. Рекомендации
echo "=========================================="
echo "📋 Рекомендации:"
echo ""

if [ "$BACKEND_TEST" != "200" ]; then
    echo "❌ Backend недоступен на localhost:3000"
    echo "   Решение:"
    echo "   1. Проверьте docker-compose.yml - порт должен быть проброшен"
    echo "   2. Перезапустите backend: docker-compose restart backend"
    echo "   3. Проверьте логи: docker-compose logs backend"
    echo ""
fi

if [ "$FRONTEND_TEST" != "200" ]; then
    echo "❌ Frontend недоступен на localhost:5173"
    echo "   Решение:"
    echo "   1. Проверьте docker-compose.yml - порт должен быть проброшен"
    echo "   2. Перезапустите frontend: docker-compose restart frontend"
    echo "   3. Проверьте логи: docker-compose logs frontend"
    echo ""
fi

if [ "$BACKEND_TEST" = "200" ] && [ "$FRONTEND_TEST" = "200" ]; then
    echo "✅ Контейнеры доступны, но nginx все еще возвращает 502"
    echo "   Возможные причины:"
    echo "   1. Неправильный proxy_pass в конфигурации"
    echo "   2. Nginx не может подключиться из-за сетевых настроек"
    echo "   3. Проблема с правами доступа"
    echo ""
    echo "   Попробуйте:"
    echo "   1. Перезагрузите nginx: systemctl reload nginx"
    echo "   2. Проверьте конфигурацию: ./fix-https-complete.sh"
    echo "   3. Проверьте логи: tail -f /var/log/nginx/error.log"
fi

echo ""
echo "✅ Диагностика завершена!"

