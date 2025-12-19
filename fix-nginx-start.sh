#!/bin/bash

# Скрипт для диагностики и исправления проблемы запуска nginx

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Диагностика и исправление проблемы запуска nginx..."
echo ""

# 1. Проверяем синтаксис конфигурации
echo "1️⃣ Проверка синтаксиса nginx..."
NGINX_TEST=$(nginx -t 2>&1)

if echo "$NGINX_TEST" | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен"
else
    echo "   ❌ Ошибки в синтаксисе:"
    echo "$NGINX_TEST" | sed 's/^/      /'
    echo ""
    
    # Показываем проблемные строки
    echo "   Проблемные строки:"
    echo "$NGINX_TEST" | grep -E "line [0-9]+" | while read line; do
        LINE_NUM=$(echo "$line" | grep -oE "line [0-9]+" | grep -oE "[0-9]+")
        if [ -n "$LINE_NUM" ]; then
            echo ""
            echo "      Строка $LINE_NUM:"
            sed -n "${LINE_NUM}p" "$CONFIG_FILE" 2>/dev/null | sed 's/^/         /'
            echo "      Контекст:"
            sed -n "$((LINE_NUM - 2)),$((LINE_NUM + 2))p" "$CONFIG_FILE" 2>/dev/null | sed 's/^/         /'
        fi
    done
    echo ""
    echo "   ❌ Исправьте ошибки перед запуском nginx!"
    exit 1
fi

echo ""

# 2. Проверяем логи systemd
echo "2️⃣ Проверка логов systemd..."
JOURNAL_LOG=$(journalctl -u nginx -n 50 --no-pager 2>&1 | tail -20)
if [ -n "$JOURNAL_LOG" ]; then
    echo "   Последние ошибки:"
    echo "$JOURNAL_LOG" | grep -i "error\|fail\|emerg" | tail -10 | sed 's/^/      /'
fi
echo ""

# 3. Проверяем, не заняты ли порты
echo "3️⃣ Проверка портов 80 и 443..."
if lsof -ti:80 >/dev/null 2>&1; then
    PORT_80_PID=$(lsof -ti:80 | head -1)
    PORT_80_PROC=$(ps -p $PORT_80_PID -o comm= 2>/dev/null || echo "unknown")
    echo "   ⚠️ Порт 80 занят процессом: $PORT_80_PROC (PID: $PORT_80_PID)"
    if ! echo "$PORT_80_PROC" | grep -q "nginx"; then
        echo "   Убиваю процесс..."
        kill -9 $PORT_80_PID 2>/dev/null
        sleep 1
    fi
else
    echo "   ✅ Порт 80 свободен"
fi

if lsof -ti:443 >/dev/null 2>&1; then
    PORT_443_PID=$(lsof -ti:443 | head -1)
    PORT_443_PROC=$(ps -p $PORT_443_PID -o comm= 2>/dev/null || echo "unknown")
    echo "   ⚠️ Порт 443 занят процессом: $PORT_443_PROC (PID: $PORT_443_PID)"
    if ! echo "$PORT_443_PROC" | grep -q "nginx"; then
        echo "   Убиваю процесс..."
        kill -9 $PORT_443_PID 2>/dev/null
        sleep 1
    fi
else
    echo "   ✅ Порт 443 свободен"
fi

echo ""

# 4. Удаляем дубликаты http2 и исправляем конфигурацию
echo "4️⃣ Проверка и исправление конфигурации..."

# Удаляем все дубликаты http2 on
HTTP2_COUNT=$(grep -c "http2 on" "$CONFIG_FILE" 2>/dev/null || echo "0")
if [ "$HTTP2_COUNT" -gt 1 ]; then
    echo "   ⚠️ Найдено $HTTP2_COUNT директив http2 on (должна быть только одна на server блок)"
    echo "   Удаляю дубликаты..."
    
    # Оставляем только первую в каждом server блоке
    awk '
    /^[[:space:]]*server[[:space:]]*{/ { 
        in_server=1
        http2_added=0
    }
    /^[[:space:]]*}/ && in_server { 
        in_server=0
        http2_added=0
    }
    /^[[:space:]]*http2 on;/ {
        if (in_server && !http2_added) {
            print
            http2_added=1
        }
        next
    }
    { print }
    ' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    
    echo "   ✅ Дубликаты удалены"
fi

# Удаляем listen с IP адресами (оставляем только 0.0.0.0 или без IP)
sed -i '/listen.*192\.168\./d' "$CONFIG_FILE"
sed -i '/listen.*10\./d' "$CONFIG_FILE"

echo ""

# 5. Проверяем синтаксис еще раз
echo "5️⃣ Повторная проверка синтаксиса..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен"
else
    echo "   ❌ Ошибки остались:"
    nginx -t 2>&1 | sed 's/^/      /'
    exit 1
fi

echo ""

# 6. Запускаем nginx
echo "6️⃣ Запуск nginx..."
systemctl start nginx 2>&1

sleep 2

# Проверяем статус
if systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx успешно запущен!"
    
    # Проверяем порты
    sleep 1
    if lsof -ti:80 >/dev/null 2>&1 && lsof -ti:443 >/dev/null 2>&1; then
        PORT_80_PROC=$(lsof -ti:80 | xargs ps -p -o comm= 2>/dev/null | head -1)
        PORT_443_PROC=$(lsof -ti:443 | xargs ps -p -o comm= 2>/dev/null | head -1)
        
        if echo "$PORT_80_PROC" | grep -q "nginx" && echo "$PORT_443_PROC" | grep -q "nginx"; then
            echo "   ✅ Порты 80 и 443 слушаются nginx"
        else
            echo "   ⚠️ Порты слушаются, но не nginx"
        fi
    else
        echo "   ⚠️ Порты не слушаются"
    fi
    
    echo ""
    echo "🧪 Тестирование..."
    sleep 1
    
    HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://${DOMAIN} 2>&1)
    HTTPS_TEST=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN} 2>&1)
    
    if [ "$HTTP_TEST" = "200" ] || [ "$HTTP_TEST" = "301" ] || [ "$HTTP_TEST" = "302" ]; then
        echo "   ✅ HTTP работает (код: $HTTP_TEST)"
    else
        echo "   ⚠️ HTTP вернул код: $HTTP_TEST"
    fi
    
    if [ "$HTTPS_TEST" = "200" ] || [ "$HTTPS_TEST" = "301" ] || [ "$HTTPS_TEST" = "302" ]; then
        echo "   ✅ HTTPS работает (код: $HTTPS_TEST)"
    else
        echo "   ⚠️ HTTPS вернул код: $HTTPS_TEST"
    fi
    
else
    echo "   ❌ Не удалось запустить nginx!"
    echo ""
    echo "   Последние ошибки:"
    journalctl -u nginx -n 20 --no-pager 2>&1 | tail -10 | sed 's/^/      /'
    echo ""
    echo "   Проверьте конфигурацию вручную:"
    echo "   nginx -t"
    echo "   journalctl -u nginx -n 50"
    exit 1
fi

echo ""
echo "✅ Готово! Nginx запущен и работает."

