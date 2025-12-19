#!/bin/bash

# Скрипт для показа структуры файла после изменений

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

echo "🔍 Показ структуры файла..."

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
echo "Показываем ВЕСЬ файл после изменений:"
cat "$CONFIG_FILE"

echo ""
echo ""
echo "Показываем строки 40-70:"
sed -n '40,70p' "$CONFIG_FILE"

echo ""
echo "Проверка синтаксиса:"
nginx -t 2>&1 | head -20

