#!/bin/bash

# Финальное исправление 502 - проверка подключения nginx к контейнерам

echo "🔧 Финальное исправление 502 Bad Gateway..."
echo ""

# 1. Проверяем доступность контейнеров
echo "1️⃣ Проверка доступности контейнеров..."
BACKEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>&1)
if [ "$BACKEND_TEST" = "200" ]; then
    echo "   ✅ Backend доступен на localhost:3000"
else
    echo "   ❌ Backend недоступен (код: $BACKEND_TEST)"
    exit 1
fi

FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "   ✅ Frontend доступен на localhost:5173"
else
    echo "   ❌ Frontend недоступен (код: $FRONTEND_TEST)"
    exit 1
fi

echo ""

# 2. Проверяем, может ли nginx подключиться
echo "2️⃣ Проверка подключения nginx к контейнерам..."
if id www-data >/dev/null 2>&1; then
    NGINX_BACKEND_TEST=$(sudo -u www-data curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>&1)
    if [ "$NGINX_BACKEND_TEST" = "200" ]; then
        echo "   ✅ Nginx может подключиться к backend"
    else
        echo "   ❌ Nginx НЕ может подключиться к backend (код: $NGINX_BACKEND_TEST)"
        echo "   Это может быть причиной 502!"
    fi
    
    NGINX_FRONTEND_TEST=$(sudo -u www-data curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173 2>&1)
    if [ "$NGINX_FRONTEND_TEST" = "200" ]; then
        echo "   ✅ Nginx может подключиться к frontend"
    else
        echo "   ❌ Nginx НЕ может подключиться к frontend (код: $NGINX_FRONTEND_TEST)"
        echo "   Это может быть причиной 502!"
    fi
else
    echo "   ⚠️ Пользователь www-data не найден, пропускаю тест"
fi

echo ""

# 3. Проверяем конфигурацию nginx
echo "3️⃣ Проверка конфигурации nginx..."
DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "   ❌ Конфигурация не найдена!"
    exit 1
fi

# Проверяем proxy_pass
echo "   Проверка proxy_pass директив:"
if grep -q "proxy_pass.*127.0.0.1:3000" "$CONFIG_FILE"; then
    echo "      ✅ proxy_pass для backend найден"
    grep "proxy_pass.*127.0.0.1:3000" "$CONFIG_FILE" | head -1 | sed 's/^/         /'
else
    echo "      ❌ proxy_pass для backend НЕ найден!"
fi

if grep -q "proxy_pass.*127.0.0.1:5173" "$CONFIG_FILE"; then
    echo "      ✅ proxy_pass для frontend найден"
    grep "proxy_pass.*127.0.0.1:5173" "$CONFIG_FILE" | head -1 | sed 's/^/         /'
else
    echo "      ❌ proxy_pass для frontend НЕ найден!"
fi

echo ""

# 4. Проверяем логи nginx
echo "4️⃣ Проверка логов nginx..."
ERROR_LOG="/var/log/nginx/error.log"
if [ -f "$ERROR_LOG" ]; then
    echo "   Последние ошибки 502:"
    tail -30 "$ERROR_LOG" | grep -i "502\|upstream\|connect\|refused" | tail -10 | sed 's/^/      /'
    
    if tail -30 "$ERROR_LOG" | grep -qi "connect.*refused.*127.0.0.1:3000"; then
        echo ""
        echo "   ❌ Найдена ошибка: не может подключиться к 127.0.0.1:3000"
        echo "   Проблема: nginx не может подключиться к backend"
    fi
    
    if tail -30 "$ERROR_LOG" | grep -qi "connect.*refused.*127.0.0.1:5173"; then
        echo ""
        echo "   ❌ Найдена ошибка: не может подключиться к 127.0.0.1:5173"
        echo "   Проблема: nginx не может подключиться к frontend"
    fi
else
    echo "   ⚠️ Лог файл не найден"
fi

echo ""

# 5. Перезагружаем nginx
echo "5️⃣ Перезагрузка nginx..."
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

# 6. Тестирование
echo "6️⃣ Тестирование..."
sleep 2

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
    echo ""
    echo "      Проверяю логи nginx в реальном времени..."
    echo "      (нажмите Ctrl+C чтобы выйти)"
    tail -f /var/log/nginx/error.log | grep -i "502\|upstream\|connect" &
    TAIL_PID=$!
    sleep 5
    kill $TAIL_PID 2>/dev/null
else
    echo "      ⚠️ HTTPS вернул код: $HTTPS_MAIN"
fi

echo ""

# 7. Если все еще 502, показываем детальную диагностику
if [ "$HTTPS_MAIN" = "502" ]; then
    echo "=========================================="
    echo "❌ ПРОБЛЕМА: 502 Bad Gateway"
    echo ""
    echo "Возможные причины:"
    echo "   1. Nginx не может подключиться к контейнерам"
    echo "   2. Неправильный proxy_pass в конфигурации"
    echo "   3. Проблемы с сетью Docker"
    echo ""
    echo "Решения:"
    echo "   1. Проверьте, что контейнеры слушают на 0.0.0.0, а не на 127.0.0.1"
    echo "   2. Убедитесь, что proxy_pass указывает на 127.0.0.1:PORT"
    echo "   3. Проверьте логи: tail -f /var/log/nginx/error.log"
    echo "   4. Перезапустите контейнеры: docker-compose restart"
else
    echo "=========================================="
    echo "✅ ВСЕ РАБОТАЕТ!"
fi

echo ""
echo "✅ Проверка завершена!"

