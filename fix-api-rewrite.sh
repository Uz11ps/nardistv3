#!/bin/bash

# Скрипт для исправления проксирования API с rewrite

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔧 Исправление проксирования API..."

# Проверяем текущую конфигурацию
echo "Текущая конфигурация location /api:"
grep -A 12 "location /api" "$CONFIG_FILE"

echo ""
echo "📝 Исправление location /api с rewrite..."

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до location /api
grep -B 1000 "location /api" "$CONFIG_FILE" | head -n -1 > "$TMP_FILE"

# Добавляем исправленный location /api с rewrite
cat >> "$TMP_FILE" << 'EOF'
    location /api {
        rewrite ^/api(.*)$ $1 break;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }

EOF

# Добавляем остальную часть после location /api
grep -A 1000 "location /api" "$CONFIG_FILE" | tail -n +13 >> "$TMP_FILE"

# Заменяем файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Конфигурация исправлена"

echo ""
echo "Проверка новой конфигурации:"
grep -A 12 "location /api" "$CONFIG_FILE"

echo ""
echo "Проверка синтаксиса:"
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен!"
    
    echo ""
    echo "Перезагрузка Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "Ожидание 2 секунды..."
    sleep 2
    
    echo ""
    echo "Проверка работы API:"
    curl -s http://nardist.site/api/health
    echo ""
else
    echo "❌ Ошибка в синтаксисе!"
    nginx -t 2>&1
fi

