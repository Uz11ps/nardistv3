#!/bin/bash

# Исправление 502 Bad Gateway после остановки Apache

echo "🔧 Исправление 502 Bad Gateway..."
echo ""

# 1. Проверяем контейнеры
echo "1️⃣ Проверка Docker контейнеров..."
cd /var/www/nardiphp 2>/dev/null || cd /root/nardiphp 2>/dev/null || {
    echo "   ❌ Не удалось найти директорию проекта"
    exit 1
}

if [ -f "docker-compose.yml" ]; then
    echo "   Статус контейнеров:"
    docker-compose ps | sed 's/^/      /'
    echo ""
    
    # Проверяем backend
    if docker-compose ps | grep -q "nardi_backend.*Up"; then
        echo "   ✅ Backend контейнер запущен"
    else
        echo "   ❌ Backend контейнер не запущен, запускаю..."
        docker-compose up -d backend
        sleep 5
    fi
    
    # Проверяем frontend
    if docker-compose ps | grep -q "nardi_frontend.*Up"; then
        echo "   ✅ Frontend контейнер запущен"
    else
        echo "   ❌ Frontend контейнер не запущен, запускаю..."
        docker-compose up -d frontend
        sleep 5
    fi
else
    echo "   ❌ docker-compose.yml не найден"
    exit 1
fi

echo ""

# 2. Проверяем доступность контейнеров
echo "2️⃣ Проверка доступности контейнеров..."
sleep 2

# Backend
echo "   Backend (localhost:3000):"
BACKEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>&1)
if [ "$BACKEND_TEST" = "200" ]; then
    echo "      ✅ Backend доступен (код: $BACKEND_TEST)"
    BACKEND_RESPONSE=$(curl -s http://localhost:3000/health 2>&1)
    echo "      Ответ: $BACKEND_RESPONSE"
else
    echo "      ❌ Backend недоступен (код: $BACKEND_TEST)"
    echo "      Проверяю логи backend..."
    docker-compose logs --tail=10 backend 2>&1 | tail -5 | sed 's/^/         /'
    echo ""
    echo "      Перезапускаю backend..."
    docker-compose restart backend
    sleep 5
fi

# Frontend
echo "   Frontend (localhost:5173):"
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "      ✅ Frontend доступен (код: $FRONTEND_TEST)"
else
    echo "      ❌ Frontend недоступен (код: $FRONTEND_TEST)"
    echo "      Проверяю логи frontend..."
    docker-compose logs --tail=10 frontend 2>&1 | tail -5 | sed 's/^/         /'
    echo ""
    echo "      Перезапускаю frontend..."
    docker-compose restart frontend
    sleep 5
fi

echo ""

# 3. Проверяем порты
echo "3️⃣ Проверка портов 3000 и 5173..."
if netstat -tlnp 2>/dev/null | grep -q ":3000" || ss -tlnp 2>/dev/null | grep -q ":3000"; then
    echo "   ✅ Порт 3000 слушается"
    if netstat -tlnp 2>/dev/null | grep ":3000"; then
        netstat -tlnp 2>/dev/null | grep ":3000" | head -1 | sed 's/^/      /'
    fi
else
    echo "   ❌ Порт 3000 НЕ слушается!"
    echo "   Backend контейнер не слушает порт 3000"
fi

if netstat -tlnp 2>/dev/null | grep -q ":5173" || ss -tlnp 2>/dev/null | grep -q ":5173"; then
    echo "   ✅ Порт 5173 слушается"
    if netstat -tlnp 2>/dev/null | grep ":5173"; then
        netstat -tlnp 2>/dev/null | grep ":5173" | head -1 | sed 's/^/      /'
    fi
else
    echo "   ❌ Порт 5173 НЕ слушается!"
    echo "   Frontend контейнер не слушает порт 5173"
fi

echo ""

# 4. Проверяем конфигурацию nginx
echo "4️⃣ Проверка конфигурации nginx..."
DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "   ❌ Конфигурация не найдена!"
    exit 1
fi

# Проверяем proxy_pass
if grep -q "proxy_pass.*127.0.0.1:3000" "$CONFIG_FILE"; then
    echo "   ✅ proxy_pass для backend найден"
else
    echo "   ❌ proxy_pass для backend НЕ найден!"
fi

if grep -q "proxy_pass.*127.0.0.1:5173" "$CONFIG_FILE"; then
    echo "   ✅ proxy_pass для frontend найден"
else
    echo "   ❌ proxy_pass для frontend НЕ найден!"
fi

echo ""

# 5. Проверяем логи nginx
echo "5️⃣ Проверка логов nginx для ошибок 502..."
ERROR_LOG="/var/log/nginx/error.log"
if [ -f "$ERROR_LOG" ]; then
    echo "   Последние ошибки 502:"
    tail -30 "$ERROR_LOG" | grep -i "502\|upstream\|connect\|refused" | tail -10 | sed 's/^/      /'
else
    echo "   ⚠️ Лог файл не найден"
fi

echo ""

# 6. Перезагружаем nginx
echo "6️⃣ Перезагрузка nginx..."
systemctl reload nginx || systemctl restart nginx
sleep 2

if systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx перезагружен"
else
    echo "   ❌ Nginx не запущен!"
    systemctl start nginx
    sleep 2
fi

echo ""

# 7. Тестирование
echo "7️⃣ Тестирование..."
sleep 2

DOMAIN="nardist.site"

echo "   Тест HTTPS главная страница:"
HTTPS_MAIN=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/ 2>&1)
if [ "$HTTPS_MAIN" = "200" ]; then
    echo "      ✅ HTTPS работает (код: $HTTPS_MAIN)"
    
    HTTPS_CONTENT=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -10)
    if echo "$HTTPS_CONTENT" | grep -qi "Website.*ready\|content is to be added"; then
        echo "      ❌ Все еще заглушка"
    else
        echo "      ✅ Контент правильный"
        if echo "$HTTPS_CONTENT" | grep -qi "Нарды\|vite\|root.*div"; then
            echo "      ✅ Это frontend приложение!"
        fi
    fi
elif [ "$HTTPS_MAIN" = "502" ]; then
    echo "      ❌ 502 Bad Gateway"
    echo "      Nginx не может подключиться к контейнерам"
    echo ""
    echo "      Проверьте:"
    echo "      1. Работают ли контейнеры: docker-compose ps"
    echo "      2. Доступны ли порты: netstat -tlnp | grep -E '3000|5173'"
    echo "      3. Логи nginx: tail -f /var/log/nginx/error.log"
else
    echo "      ⚠️ HTTPS вернул код: $HTTPS_MAIN"
fi

echo "   Тест HTTPS /health:"
HTTPS_HEALTH=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health 2>&1)
if [ "$HTTPS_HEALTH" = "200" ]; then
    echo "      ✅ /health работает"
else
    echo "      ⚠️ /health вернул код: $HTTPS_HEALTH"
fi

echo ""
echo "=========================================="
echo "✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!"
echo ""
echo "Если все еще 502:"
echo "   1. Проверьте контейнеры: docker-compose ps"
echo "   2. Проверьте логи: docker-compose logs backend frontend"
echo "   3. Проверьте порты: netstat -tlnp | grep -E '3000|5173'"
echo "   4. Перезапустите контейнеры: docker-compose restart"

