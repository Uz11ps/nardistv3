#!/bin/bash

# Скрипт для проверки структуры конфигурации

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "📝 Проверка структуры конфигурации..."

echo ""
echo "Все location блоки:"
grep -n "location" "$CONFIG_FILE"

echo ""
echo "Строки 15-50:"
sed -n '15,50p' "$CONFIG_FILE"

echo ""
echo "Проверка дубликатов location /:"
grep -n "location /" "$CONFIG_FILE" | grep -v "location ~" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health"

