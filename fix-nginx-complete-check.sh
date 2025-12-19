#!/bin/bash

# Полная проверка файла

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

echo "🔍 Полная проверка файла..."

cp "$BACKUP_FILE" "$CONFIG_FILE"

LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)
FALLBACK_LINE=$(grep -n "^[[:space:]]*location @fallback" "$CONFIG_FILE" | head -1 | cut -d: -f1)

echo "location / на строке: $LOC_LINE"
echo "location @fallback на строке: $FALLBACK_LINE"

# Проверяем что находится ПОСЛЕ @fallback
echo ""
echo "Что находится ПОСЛЕ @fallback (строки $FALLBACK_LINE-50):"
sed -n "$FALLBACK_LINE,50p" "$CONFIG_FILE"

# Проверяем есть ли ещё location / после @fallback
echo ""
echo "Проверка есть ли ещё location / после строки $FALLBACK_LINE:"
tail -n +$FALLBACK_LINE "$CONFIG_FILE" | grep -n "location /"

# Проверяем include файлы
echo ""
echo "Проверка include файлов:"
grep "include" "$CONFIG_FILE" | grep "dynamic"

# Создаём новую конфигурацию
TMP_FILE=$(mktemp)

# Копируем всё до location /
head -n $((LOC_LINE - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем location блоки
cat >> "$TMP_FILE" << 'EOF'
    location /api {
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

    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

EOF

# Добавляем остальную часть
tail -n +$FALLBACK_LINE "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем файл
mv "$TMP_FILE" "$CONFIG_FILE"

# Изменяем @fallback
sed -i 's|proxy_pass http://127.0.0.1:8080;|proxy_pass http://127.0.0.1:5173;|g' "$CONFIG_FILE"
sed -i 's|proxy_redirect http://127.0.0.1:8080 /;|proxy_redirect http://127.0.0.1:5173 /;|g' "$CONFIG_FILE"

echo ""
echo "Проверка созданного файла:"
echo "Все location блоки:"
grep -n "^[[:space:]]*location" "$CONFIG_FILE"

echo ""
echo "Все location /:"
grep -n "location /" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health"

echo ""
echo "Проверка include файлов в @fallback:"
if [ -d "/etc/nginx/vhosts-resources/nardist.site/dynamic" ]; then
    echo "Директория существует:"
    ls -la /etc/nginx/vhosts-resources/nardist.site/dynamic/
    echo ""
    echo "Содержимое файлов:"
    cat /etc/nginx/vhosts-resources/nardist.site/dynamic/*.conf 2>/dev/null || echo "Файлов нет"
fi

echo ""
echo "Проверка синтаксиса:"
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен!"
    systemctl reload nginx
    echo ""
    echo "Проверка работы:"
    curl -s http://nardist.site/api/health
else
    echo "❌ Ошибка в синтаксисе!"
    ERROR_LINE=$(nginx -t 2>&1 | grep "duplicate location" | grep -oE '[0-9]+' | head -1)
    if [ ! -z "$ERROR_LINE" ]; then
        echo "Проблемная строка: $ERROR_LINE"
        echo "Контекст:"
        sed -n "$((ERROR_LINE-5)),$((ERROR_LINE+5))p" "$CONFIG_FILE"
    fi
fi

