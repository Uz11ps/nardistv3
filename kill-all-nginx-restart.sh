#!/bin/bash

# Полная остановка всех процессов nginx и перезапуск

echo "🔥 Полная остановка всех процессов nginx..."
echo ""

# 1. Останавливаем nginx через systemctl
echo "1️⃣ Остановка nginx через systemctl..."
systemctl stop nginx 2>/dev/null || true
sleep 2

# 2. Убиваем все процессы nginx
echo "2️⃣ Убиваю все процессы nginx..."
pkill nginx 2>/dev/null || true
sleep 1
pkill -9 nginx 2>/dev/null || true
sleep 2

# Проверяем, что все процессы убиты
if pgrep nginx >/dev/null 2>&1; then
    echo "   ⚠️ Некоторые процессы все еще запущены, убиваю принудительно..."
    killall -9 nginx 2>/dev/null || true
    sleep 2
fi

if pgrep nginx >/dev/null 2>&1; then
    echo "   ❌ Не удалось убить все процессы nginx!"
    echo "   Оставшиеся процессы:"
    ps aux | grep nginx | grep -v grep | sed 's/^/      /'
    exit 1
else
    echo "   ✅ Все процессы nginx остановлены"
fi

echo ""

# 3. Освобождаем порты
echo "3️⃣ Освобождение портов 80 и 443..."
lsof -ti:80 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:443 2>/dev/null | xargs kill -9 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
sleep 2

# Проверяем, что порты свободны
if lsof -ti:80 >/dev/null 2>&1 || lsof -ti:443 >/dev/null 2>&1; then
    echo "   ⚠️ Порты все еще заняты:"
    lsof -i:80 2>/dev/null | sed 's/^/      /'
    lsof -i:443 2>/dev/null | sed 's/^/      /'
    echo "   Убиваю процессы принудительно..."
    lsof -ti:80 2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti:443 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 2
else
    echo "   ✅ Порты 80 и 443 свободны"
fi

echo ""

# 4. Проверяем конфигурацию
echo "4️⃣ Проверка конфигурации nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен"
else
    echo "   ❌ Ошибка в синтаксисе!"
    nginx -t 2>&1 | sed 's/^/      /'
    exit 1
fi

echo ""

# 5. Запускаем nginx
echo "5️⃣ Запуск nginx..."
systemctl start nginx
sleep 3

if systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx запущен"
else
    echo "   ❌ Nginx не запустился!"
    journalctl -u nginx -n 20 --no-pager | tail -10 | sed 's/^/      /'
    exit 1
fi

# Проверяем процессы
NGINX_PIDS=$(pgrep -x nginx | wc -l)
if [ "$NGINX_PIDS" -gt 0 ]; then
    echo "   ✅ Nginx процессы запущены (количество: $NGINX_PIDS)"
    ps aux | grep nginx | grep -v grep | head -3 | sed 's/^/      /'
else
    echo "   ❌ Nginx процессы не найдены!"
    exit 1
fi

echo ""

# 6. Проверяем порты
echo "6️⃣ Проверка портов..."
if lsof -ti:443 >/dev/null 2>&1; then
    PORT_443_PID=$(lsof -ti:443 | head -1)
    PORT_443_PROC=$(ps -p $PORT_443_PID -o comm= 2>/dev/null || echo "unknown")
    if echo "$PORT_443_PROC" | grep -q "nginx"; then
        echo "   ✅ Порт 443 слушается nginx (PID: $PORT_443_PID)"
    else
        echo "   ❌ Порт 443 слушается процессом: $PORT_443_PROC"
        exit 1
    fi
else
    echo "   ❌ Порт 443 не слушается!"
    exit 1
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

# 7. Тестирование
echo "7️⃣ Тестирование работы nginx..."
sleep 2

DOMAIN="nardist.site"

# Делаем тестовый запрос
echo "   Тестовый запрос к HTTPS..."
TEST_RESPONSE=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/ 2>&1)
echo "      Код ответа: $TEST_RESPONSE"

# Проверяем, появился ли запрос в access.log
sleep 1
ACCESS_LOG="/var/log/nginx/access.log"
if [ -f "$ACCESS_LOG" ]; then
    LAST_ENTRY=$(tail -1 "$ACCESS_LOG")
    if echo "$LAST_ENTRY" | grep -q "$(date +%d/%b/%Y)"; then
        echo "   ✅ Новый запрос появился в access.log!"
        echo "      Последняя запись:"
        echo "$LAST_ENTRY" | sed 's/^/      /'
    else
        echo "   ⚠️ Новый запрос не появился в access.log"
    fi
fi

if [ "$TEST_RESPONSE" = "200" ]; then
    echo "   ✅ HTTPS работает!"
    
    CONTENT=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -10)
    if echo "$CONTENT" | grep -qi "Website.*ready\|content is to be added"; then
        echo "   ⚠️ Все еще заглушка"
    else
        echo "   ✅ Контент правильный"
        if echo "$CONTENT" | grep -qi "Нарды\|vite\|root.*div"; then
            echo "   ✅ Это frontend приложение!"
        fi
    fi
elif [ "$TEST_RESPONSE" = "502" ]; then
    echo "   ❌ 502 Bad Gateway"
    echo "   Проверьте логи: tail -f /var/log/nginx/error.log"
else
    echo "   ⚠️ Код ответа: $TEST_RESPONSE"
fi

echo ""
echo "=========================================="
echo "✅ ПЕРЕЗАПУСК ЗАВЕРШЕН!"
echo ""
echo "Если все еще проблемы:"
echo "   1. Проверьте логи: tail -f /var/log/nginx/error.log"
echo "   2. Проверьте контейнеры: docker-compose ps"
echo "   3. Проверьте доступность: curl http://localhost:5173"

