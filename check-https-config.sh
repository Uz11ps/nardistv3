#!/bin/bash

# Скрипт для проверки HTTPS конфигурации

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔍 Проверка HTTPS конфигурации..."
echo ""

echo "=== Все server блоки для nardist.site ==="
grep -n "server_name.*nardist.site" "$CONFIG_FILE"

echo ""
echo "=== Проверка listen директив ==="
grep -n "listen" "$CONFIG_FILE"

echo ""
echo "=== Проверка через HTTPS ==="
echo "Запрос к https://nardist.site:"
curl -k -s https://nardist.site | head -20

echo ""
echo "=== Проверка через HTTP ==="
echo "Запрос к http://nardist.site:"
curl -s http://nardist.site | head -20

echo ""
echo "=== Проверка редиректов ==="
curl -I http://nardist.site 2>&1 | grep -i "location\|http"

