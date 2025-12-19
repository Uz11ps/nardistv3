#!/bin/bash

# Скрипт для отладки структуры Nginx конфигурации

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔍 Отладка структуры Nginx конфигурации..."
echo ""

# Показываем строки вокруг проблемной строки 74
echo "Строки 70-80:"
sed -n '70,80p' "$CONFIG_FILE"

echo ""
echo "Все location блоки:"
grep -n "location" "$CONFIG_FILE"

echo ""
echo "Все закрывающие скобки server блока:"
grep -n "^[[:space:]]*}" "$CONFIG_FILE" | head -10

echo ""
echo "Структура server блока:"
SERVER_LINE=$(grep -n "^[[:space:]]*server {" "$CONFIG_FILE" | head -1 | cut -d: -f1)
echo "server блок начинается на строке: $SERVER_LINE"

# Находим закрывающую скобку server блока
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

echo "server блок заканчивается на строке: $SERVER_CLOSE"

echo ""
echo "Содержимое server блока (строки $SERVER_LINE-$SERVER_CLOSE):"
sed -n "${SERVER_LINE},${SERVER_CLOSE}p" "$CONFIG_FILE"

