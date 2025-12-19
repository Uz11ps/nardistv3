#!/bin/bash

# Скрипт для проверки структуры Nginx конфигурации

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔍 Проверка структуры Nginx конфигурации..."
echo ""

# Находим server блок
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

# Находим location / блок
LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | head -1 | cut -d: -f1)
echo "location / на строке: $LOC_LINE"

# Проверяем что location / внутри server блока
if [ "$LOC_LINE" -gt "$SERVER_LINE" ] && [ "$LOC_LINE" -lt "$SERVER_CLOSE" ]; then
    echo "✅ location / находится внутри server блока"
else
    echo "❌ location / находится ВНЕ server блока!"
fi

echo ""
echo "Структура вокруг location / (строки $((LOC_LINE-5))-$((LOC_LINE+10))):"
sed -n "$((LOC_LINE-5)),$((LOC_LINE+10))p" "$CONFIG_FILE"

echo ""
echo "Структура перед закрывающей скобкой server (строки $((SERVER_CLOSE-10))-$SERVER_CLOSE):"
sed -n "$((SERVER_CLOSE-10)),${SERVER_CLOSE}p" "$CONFIG_FILE"
