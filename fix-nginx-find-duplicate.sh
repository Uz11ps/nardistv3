#!/bin/bash

# Скрипт для поиска дубликата location /

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

echo "🔍 Поиск дубликата location /..."

cp "$BACKUP_FILE" "$CONFIG_FILE"

LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)
FALLBACK_LINE=$(grep -n "^[[:space:]]*location @fallback" "$CONFIG_FILE" | head -1 | cut -d: -f1)

echo "location / на строке: $LOC_LINE"
echo "location @fallback на строке: $FALLBACK_LINE"

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
echo "Проверка ВСЕГО файла:"
echo "Всего строк в файле:"
wc -l "$CONFIG_FILE"

echo ""
echo "Все location блоки в файле:"
grep -n "^[[:space:]]*location" "$CONFIG_FILE"

echo ""
echo "Все location / (включая вложенные):"
grep -n "location /" "$CONFIG_FILE"

echo ""
echo "Показываем весь файл после изменений (строки 40-80):"
sed -n '40,80p' "$CONFIG_FILE"

echo ""
echo "Проверка синтаксиса с подробным выводом:"
nginx -T 2>&1 | grep -A 5 -B 5 "location /" | head -30

echo ""
echo "Проверка синтаксиса:"
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен!"
    systemctl reload nginx
    echo ""
    echo "Проверка работы:"
    curl -s http://nardist.site/api/health
else
    ERROR_OUTPUT=$(nginx -t 2>&1)
    echo "❌ Ошибка в синтаксисе!"
    echo "$ERROR_OUTPUT"
    
    # Пытаемся найти строку с ошибкой
    ERROR_LINE=$(echo "$ERROR_OUTPUT" | grep "duplicate location" | grep -oE '[0-9]+' | head -1)
    if [ ! -z "$ERROR_LINE" ]; then
        echo ""
        echo "Проблемная строка: $ERROR_LINE"
        echo "Контекст (строки $((ERROR_LINE-10))-$((ERROR_LINE+10))):"
        sed -n "$((ERROR_LINE-10)),$((ERROR_LINE+10))p" "$CONFIG_FILE"
    fi
fi

