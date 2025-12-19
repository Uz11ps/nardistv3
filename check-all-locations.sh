#!/bin/bash

# Скрипт для проверки всех location блоков

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔍 Проверка всех location блоков..."
echo ""

echo "=== Все location блоки в файле ==="
grep -n "location" "$CONFIG_FILE"

echo ""
echo "=== Полная структура server блока ==="
SERVER_LINE=$(grep -n "server_name.*nardist.site" "$CONFIG_FILE" | head -1 | cut -d: -f1)
if [ -n "$SERVER_LINE" ]; then
    # Находим начало server блока
    while [ "$SERVER_LINE" -gt 0 ]; do
        if grep -q "^[[:space:]]*server {" <(sed -n "${SERVER_LINE}p" "$CONFIG_FILE"); then
            break
        fi
        SERVER_LINE=$((SERVER_LINE - 1))
    done
    
    # Находим конец server блока
    SERVER_CLOSE=""
    INDENT=$(sed -n "${SERVER_LINE}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
    INDENT=$((INDENT - 1))
    
    for i in $(seq $((SERVER_LINE + 1)) $(wc -l < "$CONFIG_FILE")); do
        line=$(sed -n "${i}p" "$CONFIG_FILE")
        line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
        line_indent=$((line_indent - 1))
        
        if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
            SERVER_CLOSE=$i
            break
        fi
    done
    
    if [ -n "$SERVER_CLOSE" ]; then
        echo "server блок: строки $SERVER_LINE-$SERVER_CLOSE"
        echo ""
        sed -n "${SERVER_LINE},${SERVER_CLOSE}p" "$CONFIG_FILE"
    fi
fi

echo ""
echo "=== Проверка через curl ==="
echo "Запрос к http://nardist.site:"
curl -v http://nardist.site 2>&1 | head -30

