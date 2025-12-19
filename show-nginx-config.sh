#!/bin/bash

# Скрипт для показа текущей конфигурации Nginx

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "📋 Текущая конфигурация Nginx для nardist.site:"
echo ""
echo "=== Полный файл ==="
cat "$CONFIG_FILE"
echo ""
echo "=== Строки 55-65 (вокруг ошибки) ==="
sed -n '55,65p' "$CONFIG_FILE"
echo ""
echo "=== Все location блоки ==="
grep -n "location" "$CONFIG_FILE"
echo ""
echo "=== Все закрывающие скобки ==="
grep -n "^[[:space:]]*}" "$CONFIG_FILE" | head -20

