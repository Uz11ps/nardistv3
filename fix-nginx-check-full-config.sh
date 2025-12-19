#!/bin/bash

# Скрипт для проверки полной конфигурации Nginx

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

echo "🔍 Проверка полной конфигурации Nginx..."

# Сначала проверим текущую конфигурацию
echo "Проверка текущей конфигурации:"
nginx -T 2>&1 | grep -A 5 "server_name.*nardist" | head -30

echo ""
echo "Все location / в полной конфигурации для nardist.site:"
nginx -T 2>&1 | grep -B 10 -A 10 "server_name.*nardist" | grep -n "location /" | head -20

echo ""
echo "📝 Создание правильной конфигурации..."

cp "$BACKUP_FILE" "$CONFIG_FILE"

LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)
FALLBACK_LINE=$(grep -n "^[[:space:]]*location @fallback" "$CONFIG_FILE" | head -1 | cut -d: -f1)

echo "location / на строке: $LOC_LINE"
echo "location @fallback на строке: $FALLBACK_LINE"

# Создаём временный файл
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
echo "Проверка полной конфигурации после изменений:"
FULL_CONFIG=$(nginx -T 2>&1)
if echo "$FULL_CONFIG" | grep -q "duplicate location"; then
    echo "❌ Найден дубликат location / в полной конфигурации!"
    echo ""
    echo "Все location / для nardist.site:"
    echo "$FULL_CONFIG" | grep -B 20 "server_name.*nardist" | grep -A 50 "server_name.*nardist" | grep -n "location /"
else
    echo "✅ Дубликатов не найдено в полной конфигурации"
    
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
        nginx -t 2>&1
    fi
fi

