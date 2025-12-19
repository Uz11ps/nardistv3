#!/bin/bash

# Проверка, действительно ли nginx работает и обрабатывает запросы

echo "🔍 Проверка, действительно ли nginx работает..."
echo ""

# 1. Проверяем статус nginx
echo "1️⃣ Статус nginx..."
if systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx активен (systemctl)"
else
    echo "   ❌ Nginx НЕ активен!"
    systemctl status nginx --no-pager | head -10
    exit 1
fi

if pgrep -x nginx >/dev/null 2>&1; then
    NGINX_PIDS=$(pgrep -x nginx)
    echo "   ✅ Nginx процессы запущены (PIDs: $NGINX_PIDS)"
    ps aux | grep nginx | grep -v grep | head -5 | sed 's/^/      /'
else
    echo "   ❌ Nginx процессы НЕ найдены!"
    exit 1
fi

echo ""

# 2. Проверяем порты
echo "2️⃣ Проверка портов..."
if lsof -ti:443 >/dev/null 2>&1; then
    PORT_443_PID=$(lsof -ti:443 | head -1)
    PORT_443_PROC=$(ps -p $PORT_443_PID -o comm= 2>/dev/null || echo "unknown")
    if echo "$PORT_443_PROC" | grep -q "nginx"; then
        echo "   ✅ Порт 443 слушается nginx (PID: $PORT_443_PID)"
    else
        echo "   ❌ Порт 443 слушается процессом: $PORT_443_PROC (не nginx!)"
        echo "   Убиваю процесс..."
        kill -9 $PORT_443_PID 2>/dev/null
        sleep 2
        systemctl restart nginx
        sleep 3
    fi
else
    echo "   ❌ Порт 443 НЕ слушается!"
    echo "   Перезапускаю nginx..."
    systemctl restart nginx
    sleep 3
fi

if lsof -ti:80 >/dev/null 2>&1; then
    PORT_80_PID=$(lsof -ti:80 | head -1)
    PORT_80_PROC=$(ps -p $PORT_80_PID -o comm= 2>/dev/null || echo "unknown")
    if echo "$PORT_80_PROC" | grep -q "nginx"; then
        echo "   ✅ Порт 80 слушается nginx (PID: $PORT_80_PID)"
    else
        echo "   ⚠️ Порт 80 слушается процессом: $PORT_80_PROC"
    fi
else
    echo "   ⚠️ Порт 80 не слушается"
fi

echo ""

# 3. Проверяем access.log - должны быть новые записи
echo "3️⃣ Проверка access.log (должны быть новые записи)..."
ACCESS_LOG="/var/log/nginx/access.log"
if [ -f "$ACCESS_LOG" ]; then
    LAST_ACCESS=$(stat -c %Y "$ACCESS_LOG" 2>/dev/null || stat -f %m "$ACCESS_LOG" 2>/dev/null)
    NOW=$(date +%s)
    DIFF=$((NOW - LAST_ACCESS))
    
    if [ "$DIFF" -lt 60 ]; then
        echo "   ✅ Access.log обновлялся недавно ($DIFF секунд назад)"
        echo "   Последние 5 запросов:"
        tail -5 "$ACCESS_LOG" | sed 's/^/      /'
    else
        echo "   ⚠️ Access.log НЕ обновлялся $DIFF секунд (более минуты)"
        echo "   Это значит nginx не обрабатывает запросы!"
        echo "   Последние записи:"
        tail -5 "$ACCESS_LOG" | sed 's/^/      /'
    fi
else
    echo "   ⚠️ Access.log не найден"
fi

echo ""

# 4. Делаем тестовый запрос и проверяем, появится ли он в логах
echo "4️⃣ Тестовый запрос к nginx..."
DOMAIN="nardist.site"
TEST_TIME=$(date +%s)

# Делаем запрос
curl -k -s -o /dev/null https://${DOMAIN}/ 2>&1 &
CURL_PID=$!
sleep 2

# Проверяем, появился ли запрос в access.log
if [ -f "$ACCESS_LOG" ]; then
    sleep 1
    NEW_ENTRIES=$(tail -20 "$ACCESS_LOG" | grep -E "$(date +%d/%b/%Y)" | tail -3)
    if [ -n "$NEW_ENTRIES" ]; then
        echo "   ✅ Новые записи в access.log найдены:"
        echo "$NEW_ENTRIES" | sed 's/^/      /'
    else
        echo "   ❌ Новых записей в access.log НЕТ!"
        echo "   Nginx не обрабатывает запросы!"
    fi
fi

echo ""

# 5. Проверяем error.log на новые ошибки
echo "5️⃣ Проверка error.log на новые ошибки..."
ERROR_LOG="/var/log/nginx/error.log"
if [ -f "$ERROR_LOG" ]; then
    # Ищем ошибки за последние 5 минут
    RECENT_ERRORS=$(tail -50 "$ERROR_LOG" | grep -E "$(date +%Y/%m/%d)" | tail -10)
    if [ -n "$RECENT_ERRORS" ]; then
        echo "   ⚠️ Найдены недавние ошибки:"
        echo "$RECENT_ERRORS" | sed 's/^/      /'
    else
        echo "   ✅ Новых ошибок нет (или они старые)"
    fi
fi

echo ""

# 6. Проверяем конфигурацию nginx
echo "6️⃣ Проверка конфигурации nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен"
else
    echo "   ❌ Ошибка в синтаксисе!"
    nginx -t 2>&1 | sed 's/^/      /'
fi

echo ""

# 7. Проверяем, может ли nginx подключиться к контейнерам
echo "7️⃣ Тест подключения nginx к контейнерам..."
if id www-data >/dev/null 2>&1; then
    echo "   Тест backend:"
    NGINX_BACKEND=$(sudo -u www-data timeout 3 curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>&1)
    if [ "$NGINX_BACKEND" = "200" ]; then
        echo "      ✅ Nginx может подключиться к backend"
    else
        echo "      ❌ Nginx НЕ может подключиться к backend (код: $NGINX_BACKEND)"
    fi
    
    echo "   Тест frontend:"
    NGINX_FRONTEND=$(sudo -u www-data timeout 3 curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173 2>&1)
    if [ "$NGINX_FRONTEND" = "200" ]; then
        echo "      ✅ Nginx может подключиться к frontend"
    else
        echo "      ❌ Nginx НЕ может подключиться к frontend (код: $NGINX_FRONTEND)"
    fi
fi

echo ""

# 8. Итоги и рекомендации
echo "=========================================="
echo "📋 ИТОГИ:"
echo ""

if [ "$DIFF" -gt 60 ]; then
    echo "❌ ПРОБЛЕМА: Nginx не обрабатывает запросы!"
    echo ""
    echo "Решения:"
    echo "   1. Полностью перезапустите nginx:"
    echo "      systemctl stop nginx"
    echo "      pkill -9 nginx"
    echo "      systemctl start nginx"
    echo ""
    echo "   2. Проверьте, что порт 443 свободен:"
    echo "      lsof -i:443"
    echo ""
    echo "   3. Проверьте конфигурацию:"
    echo "      nginx -t"
    echo ""
    echo "   4. Проверьте, нет ли другого процесса на порту 443:"
    echo "      netstat -tlnp | grep 443"
else
    echo "✅ Nginx обрабатывает запросы"
    echo "   Если все еще 502, проблема в proxy_pass или подключении к контейнерам"
fi

echo ""
echo "✅ Проверка завершена!"

