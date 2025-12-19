#!/bin/bash

# Скрипт для проверки содержимого tail

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

echo "🔍 Проверка содержимого tail..."

cp "$BACKUP_FILE" "$CONFIG_FILE"

LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)
FALLBACK_LINE=$(grep -n "^[[:space:]]*location @fallback" "$CONFIG_FILE" | head -1 | cut -d: -f1)

echo "location / на строке: $LOC_LINE"
echo "location @fallback на строке: $FALLBACK_LINE"

echo ""
echo "Что находится в tail начиная с FALLBACK_LINE:"
tail -n +$FALLBACK_LINE "$CONFIG_FILE" | head -20

echo ""
echo "Что находится ПЕРЕД FALLBACK_LINE (строки $((FALLBACK_LINE-5))-$((FALLBACK_LINE-1))):"
sed -n "$((FALLBACK_LINE-5)),$((FALLBACK_LINE-1))p" "$CONFIG_FILE"

