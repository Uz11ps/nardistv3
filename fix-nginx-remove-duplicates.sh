#!/bin/bash

# Скрипт для удаления дубликатов location блоков

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔧 Удаление дубликатов location блоков..."

# Проверяем дубликаты
echo ""
echo "Проверка дубликатов:"
API_LINES=$(grep -n "location /api {" "$CONFIG_FILE" | cut -d: -f1)
SOCKET_LINES=$(grep -n "location /socket.io {" "$CONFIG_FILE" | cut -d: -f1)
HEALTH_LINES=$(grep -n "location /health {" "$CONFIG_FILE" | cut -d: -f1)
ROOT_LINES=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | cut -d: -f1)

echo "location /api на строках: $API_LINES"
echo "location /socket.io на строках: $SOCKET_LINES"
echo "location /health на строках: $HEALTH_LINES"
echo "location / на строках: $ROOT_LINES"

# Если есть дубликаты, восстанавливаем из бэкапа
if [ -f "$CONFIG_FILE.backup" ]; then
    echo ""
    echo "Восстановление из бэкапа..."
    cp "$CONFIG_FILE.backup" "$CONFIG_FILE"
    echo "✅ Конфигурация восстановлена из бэкапа"
else
    echo ""
    echo "⚠️ Бэкап не найден, создаём новый..."
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
fi

echo ""
echo "Теперь запустите: ./fix-nginx-frontend-proxy-v2.sh"

