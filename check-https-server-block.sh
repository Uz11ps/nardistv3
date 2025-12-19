#!/bin/bash

# Скрипт для проверки HTTPS server блока

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔍 Поиск HTTPS server блока..."
echo ""

echo "=== Все server блоки в файле ==="
grep -n "server {" "$CONFIG_FILE"

echo ""
echo "=== Все listen директивы ==="
grep -n "listen" "$CONFIG_FILE"

echo ""
echo "=== Все server_name с nardist.site ==="
grep -n "server_name.*nardist.site" "$CONFIG_FILE"

echo ""
echo "=== Проверка структуры файла ==="
echo "Первые 30 строк:"
head -30 "$CONFIG_FILE"

echo ""
echo "=== Поиск HTTPS блока (listen 443 или ssl) ==="
grep -B 5 -A 20 "listen.*443\|ssl_certificate" "$CONFIG_FILE" | head -50

