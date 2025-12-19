#!/bin/bash

# Скрипт для удаления конфликтующей конфигурации

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
CONF_D_FILE="/etc/nginx/conf.d/nardist.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

echo "🔧 Удаление конфликтующей конфигурации..."

# Проверяем есть ли конфигурация в conf.d
if [ -f "$CONF_D_FILE" ]; then
    echo "⚠️ Найдена конфигурация в /etc/nginx/conf.d/nardist.conf"
    echo "Удаляем её чтобы избежать конфликта..."
    rm -f "$CONF_D_FILE"
    echo "✅ Конфигурация удалена"
fi

echo ""
echo "📝 Шаг 1: Восстановление из бэкапа..."
cp "$BACKUP_FILE" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 2: Изменение @fallback..."
sed -i 's|proxy_pass http://127.0.0.1:8080;|proxy_pass http://127.0.0.1:5173;|g' "$CONFIG_FILE"
sed -i 's|proxy_redirect http://127.0.0.1:8080 /;|proxy_redirect http://127.0.0.1:5173 /;|g' "$CONFIG_FILE"

echo ""
echo "📝 Шаг 3: Поиск строк..."
LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)
FALLBACK_LINE=$(grep -n "^[[:space:]]*location @fallback" "$CONFIG_FILE" | head -1 | cut -d: -f1)

echo "location / на строке: $LOC_LINE"
echo "location @fallback на строке: $FALLBACK_LINE"

echo ""
echo "📝 Шаг 4: Создание новой конфигурации..."

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

echo "✅ Конфигурация создана"

echo ""
echo "📝 Шаг 5: Проверка структуры..."
echo "Все location блоки:"
grep -n "^[[:space:]]*location" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 6: Проверка синтаксиса..."
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен!"
    
    echo ""
    echo "📝 Шаг 7: Перезагрузка Nginx..."
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
    
    echo ""
    echo "⏳ Ожидание 3 секунды..."
    sleep 3
    
    echo ""
    echo "📝 Шаг 8: Проверка работы..."
    echo "Frontend:"
    curl -s http://nardist.site 2>&1 | head -5
    echo ""
    echo "Backend API:"
    curl -s http://nardist.site/api/health 2>&1
    
    echo ""
    echo "✅ Готово!"
else
    echo "❌ Ошибка в синтаксисе!"
    ERROR_OUTPUT=$(nginx -t 2>&1)
    echo "$ERROR_OUTPUT"
    
    ERROR_LINE=$(echo "$ERROR_OUTPUT" | grep "duplicate location" | grep -oE '[0-9]+' | head -1)
    if [ ! -z "$ERROR_LINE" ]; then
        echo ""
        echo "Проблемная строка: $ERROR_LINE"
        echo "Контекст:"
        sed -n "$((ERROR_LINE-5)),$((ERROR_LINE+5))p" "$CONFIG_FILE"
    fi
    
    echo ""
    echo "Проверка всех server блоков для nardist.site:"
    nginx -T 2>&1 | grep -A 20 "server_name.*nardist"
fi

