#!/bin/bash

# Скрипт для исправления синтаксических ошибок nginx

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Исправление синтаксических ошибок nginx..."
echo ""

# Создаём бэкап
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "📦 Создан бэкап: $BACKUP_FILE"
echo ""

# 1. Исправляем устаревший синтаксис http2
echo "1️⃣ Исправление синтаксиса http2..."
sed -i 's/listen \(.*\) ssl http2;/listen \1 ssl;\n    http2 on;/g' "$CONFIG_FILE"
sed -i 's/listen \[::\]:\(.*\) ssl http2;/listen [::]:\1 ssl;\n    http2 on;/g' "$CONFIG_FILE"

echo "   ✅ Синтаксис http2 исправлен"
echo ""

# 2. Находим и удаляем дубликаты listen
echo "2️⃣ Поиск дубликатов listen..."
DUPLICATE_LINE=$(grep -n "listen.*80" "$CONFIG_FILE" | grep -v "443" | tail -1 | cut -d: -f1)

if [ -n "$DUPLICATE_LINE" ]; then
    echo "   ⚠️ Найден дубликат listen на строке $DUPLICATE_LINE"
    
    # Показываем контекст
    echo "   Контекст:"
    sed -n "$((DUPLICATE_LINE - 2)),$((DUPLICATE_LINE + 2))p" "$CONFIG_FILE" | sed 's/^/      /'
    echo ""
    
    # Проверяем, это лишний блок или просто дубликат в одном блоке
    LINE_CONTENT=$(sed -n "${DUPLICATE_LINE}p" "$CONFIG_FILE")
    
    # Если это IP адрес с портом, удаляем эту строку
    if echo "$LINE_CONTENT" | grep -q "listen.*192\.168\."; then
        echo "   Удаляю строку с IP адресом..."
        sed -i "${DUPLICATE_LINE}d" "$CONFIG_FILE"
        echo "   ✅ Дубликат удален"
    else
        # Иначе это может быть отдельный server блок - нужно проверить
        echo "   Проверяю, это отдельный server блок..."
        
        # Находим начало server блока
        SERVER_START=$DUPLICATE_LINE
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
        
        # Проверяем, есть ли в этом блоке server_name
        SERVER_BLOCK=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")
        
        if echo "$SERVER_BLOCK" | grep -q "server_name.*${DOMAIN}"; then
            echo "   ⚠️ Это server блок для ${DOMAIN}, но с дубликатом listen"
            echo "   Удаляю дубликат listen..."
            sed -i "${DUPLICATE_LINE}d" "$CONFIG_FILE"
            echo "   ✅ Дубликат удален"
        else
            echo "   Это отдельный server блок, возможно лишний"
            echo "   Удаляю весь блок (строки $SERVER_START-$SERVER_END)..."
            
            # Удаляем блок
            sed -i "${SERVER_START},${SERVER_END}d" "$CONFIG_FILE"
            echo "   ✅ Блок удален"
        fi
    fi
else
    echo "   ✅ Дубликатов не найдено"
fi

echo ""

# 3. Проверяем синтаксис
echo "3️⃣ Проверка синтаксиса nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен!"
    echo ""
    
    echo "🔄 Перезагрузка nginx..."
    systemctl reload nginx || service nginx reload
    sleep 2
    
    echo ""
    echo "✅ Исправление завершено!"
    echo ""
    echo "Проверьте работу:"
    echo "   curl -I http://${DOMAIN}"
    echo "   curl -k -I https://${DOMAIN}"
    
else
    echo "   ❌ Ошибки в синтаксисе:"
    nginx -t 2>&1 | sed 's/^/      /'
    echo ""
    echo "🔄 Восстановление из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    echo ""
    echo "Показываю проблемные строки:"
    nginx -t 2>&1 | grep -E "line [0-9]+" | while read line; do
        LINE_NUM=$(echo "$line" | grep -oE "line [0-9]+" | grep -oE "[0-9]+")
        if [ -n "$LINE_NUM" ]; then
            echo ""
            echo "   Строка $LINE_NUM:"
            sed -n "${LINE_NUM}p" "$CONFIG_FILE" | sed 's/^/      /'
            echo "   Контекст:"
            sed -n "$((LINE_NUM - 2)),$((LINE_NUM + 2))p" "$CONFIG_FILE" | sed 's/^/      /'
        fi
    done
    exit 1
fi

