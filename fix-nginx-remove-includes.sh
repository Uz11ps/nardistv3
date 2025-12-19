#!/bin/bash

# Скрипт для удаления конфликтующих include файлов

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"
INCLUDE_DIR="/etc/nginx/vhosts-resources/nardist.site"

echo "🔧 Удаление конфликтующих include файлов..."

# Проверяем include файлы
echo "📝 Проверка include файлов в $INCLUDE_DIR:"
if [ -d "$INCLUDE_DIR" ]; then
    echo "Директория существует:"
    ls -la "$INCLUDE_DIR"
    
    echo ""
    echo "Содержимое всех .conf файлов:"
    for file in "$INCLUDE_DIR"/*.conf; do
        if [ -f "$file" ]; then
            echo "--- $file ---"
            cat "$file"
            echo ""
        fi
    done
    
    # Удаляем proxy.conf если он есть
    if [ -f "$INCLUDE_DIR/proxy.conf" ]; then
        echo "⚠️ Найден proxy.conf, удаляем..."
        rm -f "$INCLUDE_DIR/proxy.conf"
        echo "✅ proxy.conf удалён"
    fi
    
    # Проверяем есть ли location / в других файлах
    echo ""
    echo "Проверка location / в include файлах:"
    grep -r "location /" "$INCLUDE_DIR"/*.conf 2>/dev/null || echo "location / не найден в include файлах"
fi

echo ""
echo "📝 Шаг 1: Восстановление из бэкапа..."
cp "$BACKUP_FILE" "$CONFIG_FILE"

LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)
FALLBACK_LINE=$(grep -n "^[[:space:]]*location @fallback" "$CONFIG_FILE" | head -1 | cut -d: -f1)

echo "location / на строке: $LOC_LINE"
echo "location @fallback на строке: $FALLBACK_LINE"

echo ""
echo "📝 Шаг 2: Создание новой конфигурации..."

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

echo "✅ Конфигурация создана"

echo ""
echo "📝 Шаг 3: Проверка синтаксиса..."
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен!"
    
    echo ""
    echo "📝 Шаг 4: Перезагрузка Nginx..."
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
    
    echo ""
    echo "⏳ Ожидание 3 секунды..."
    sleep 3
    
    echo ""
    echo "📝 Шаг 5: Проверка работы..."
    echo "Frontend:"
    curl -s http://nardist.site 2>&1 | head -5
    echo ""
    echo "Backend API:"
    curl -s http://nardist.site/api/health 2>&1
    
    echo ""
    echo "✅ Готово!"
else
    echo "❌ Ошибка в синтаксисе!"
    nginx -t 2>&1
fi

