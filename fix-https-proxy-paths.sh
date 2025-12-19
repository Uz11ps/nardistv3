#!/bin/bash

# Скрипт для исправления proxy_pass путей в HTTPS блоке

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Исправление proxy_pass путей в HTTPS блоке..."
echo ""

# Создаём бэкап
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "📦 Создан бэкап: $BACKUP_FILE"
echo ""

# Находим HTTPS server блок
HTTPS_BLOCK_START=$(grep -n "listen.*443" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -z "$HTTPS_BLOCK_START" ]; then
    echo "❌ HTTPS server блок не найден!"
    exit 1
fi

# Находим начало server блока
SERVER_START=$HTTPS_BLOCK_START
while [ "$SERVER_START" -gt 0 ]; do
    if grep -q "^[[:space:]]*server {" <(sed -n "${SERVER_START}p" "$CONFIG_FILE" 2>/dev/null); then
        break
    fi
    SERVER_START=$((SERVER_START - 1))
done

# Находим конец server блока
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

echo "✅ HTTPS server блок найден (строки $SERVER_START-$SERVER_END)"
echo ""

# Проверяем и исправляем proxy_pass
HTTPS_BLOCK=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")

# Проверяем, есть ли неправильные proxy_pass
NEEDS_FIX=0

if echo "$HTTPS_BLOCK" | grep -q "proxy_pass.*localhost:3000"; then
    echo "⚠️ Найден proxy_pass с localhost:3000 (нужно заменить на 127.0.0.1:3000)"
    NEEDS_FIX=1
fi

if echo "$HTTPS_BLOCK" | grep -q "proxy_pass.*localhost:5173"; then
    echo "⚠️ Найден proxy_pass с localhost:5173 (нужно заменить на 127.0.0.1:5173)"
    NEEDS_FIX=1
fi

if ! echo "$HTTPS_BLOCK" | grep -q "proxy_pass.*127.0.0.1:3000"; then
    echo "⚠️ proxy_pass для backend (3000) не найден или неправильный"
    NEEDS_FIX=1
fi

if ! echo "$HTTPS_BLOCK" | grep -q "proxy_pass.*127.0.0.1:5173"; then
    echo "⚠️ proxy_pass для frontend (5173) не найден или неправильный"
    NEEDS_FIX=1
fi

if [ "$NEEDS_FIX" -eq 0 ]; then
    echo "✅ Все proxy_pass пути правильные"
    echo ""
    echo "Проверяю другие возможные проблемы..."
    
    # Проверяем наличие всех необходимых заголовков
    if ! echo "$HTTPS_BLOCK" | grep -q "proxy_set_header Host"; then
        echo "⚠️ Отсутствует proxy_set_header Host"
        NEEDS_FIX=1
    fi
    
    if ! echo "$HTTPS_BLOCK" | grep -q "proxy_set_header X-Forwarded-Proto"; then
        echo "⚠️ Отсутствует proxy_set_header X-Forwarded-Proto"
        NEEDS_FIX=1
    fi
fi

if [ "$NEEDS_FIX" -eq 1 ]; then
    echo ""
    echo "🔧 Исправляю конфигурацию..."
    
    # Заменяем localhost на 127.0.0.1
    sed -i 's/proxy_pass http:\/\/localhost:/proxy_pass http:\/\/127.0.0.1:/g' "$CONFIG_FILE"
    
    echo "✅ Заменены localhost на 127.0.0.1"
    
    # Проверяем синтаксис
    echo ""
    echo "🔍 Проверка синтаксиса..."
    if nginx -t 2>&1 | grep -q "successful"; then
        echo "✅ Синтаксис корректен"
        echo ""
        echo "🔄 Перезагрузка nginx..."
        systemctl reload nginx || service nginx reload
        echo ""
        
        echo "🧪 Тестирование..."
        sleep 2
        HTTPS_TEST=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health 2>&1)
        if [ "$HTTPS_TEST" = "200" ]; then
            echo "✅ HTTPS теперь работает!"
        else
            echo "⚠️ HTTPS вернул код: $HTTPS_TEST"
            echo "   Проверьте логи: tail -f /var/log/nginx/error.log"
        fi
    else
        echo "❌ Ошибка в синтаксисе!"
        nginx -t 2>&1
        echo ""
        echo "🔄 Восстановление из бэкапа..."
        cp "$BACKUP_FILE" "$CONFIG_FILE"
        exit 1
    fi
else
    echo ""
    echo "✅ Конфигурация выглядит правильной"
    echo ""
    echo "Проверяю логи nginx для понимания проблемы..."
    echo "Последние ошибки:"
    tail -20 /var/log/nginx/error.log 2>/dev/null | grep -i "nardist\|502\|connect" | tail -5 | sed 's/^/   /' || echo "   Нет ошибок в логах"
fi

echo ""
echo "✅ Проверка завершена!"

