#!/bin/bash

# Полный скрипт для исправления конфигурации Nginx для ISPmanager

SERVER="root@91.229.9.80"
CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

echo "🔧 Полное исправление конфигурации Nginx для nardist.site..."

ssh $SERVER << ENDSSH
set -e

echo "📝 Шаг 1: Создание бэкапа..."
if [ ! -f "$BACKUP_FILE" ]; then
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo "✅ Бэкап создан: $BACKUP_FILE"
else
    echo "✅ Бэкап уже существует, восстанавливаем из него..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
fi

echo ""
echo "📝 Шаг 2: Изменение @fallback для проксирования на frontend..."
sed -i 's|proxy_pass http://127.0.0.1:8080;|proxy_pass http://127.0.0.1:5173;|g' "$CONFIG_FILE"
sed -i 's|proxy_redirect http://127.0.0.1:8080 /;|proxy_redirect http://127.0.0.1:5173 /;|g' "$CONFIG_FILE"
echo "✅ @fallback изменен для проксирования на порт 5173"

echo ""
echo "📝 Шаг 3: Поиск места для вставки location блоков..."
# Находим строку с основным location / (не вложенным)
MAIN_LOCATION_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -z "$MAIN_LOCATION_LINE" ]; then
    echo "❌ Не найдена строка с location /"
    exit 1
fi

echo "✅ Найдена строка $MAIN_LOCATION_LINE"

echo ""
echo "📝 Шаг 4: Добавление location блоков для API перед основным location /..."

# Создаем временный файл
TMP_FILE=$(mktemp)

# Копируем всё до location /
head -n $((MAIN_LOCATION_LINE - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем location блоки для API
cat >> "$TMP_FILE" << 'LOCATION_BLOCKS'
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
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
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
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;
        }

        location /health {
            proxy_pass http://127.0.0.1:3000/health;
            access_log off;
        }

LOCATION_BLOCKS

# Добавляем остальную часть файла
tail -n +$MAIN_LOCATION_LINE "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем оригинальный файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Location блоки добавлены"

echo ""
echo "📝 Шаг 5: Проверка синтаксиса..."
if nginx -t; then
    echo "✅ Синтаксис корректен"
else
    echo "❌ Ошибка в синтаксисе!"
    echo "Восстанавливаем из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

echo ""
echo "📝 Шаг 6: Перезагрузка Nginx..."
systemctl reload nginx
echo "✅ Nginx перезагружен"

echo ""
echo "⏳ Ожидание 3 секунды..."
sleep 3

echo ""
echo "📝 Шаг 7: Проверка работы..."
echo "Frontend:"
curl -s http://nardist.site | head -5
echo ""
echo "Backend API:"
curl -s http://nardist.site/api/health
echo ""

echo ""
echo "✅ Готово! Конфигурация исправлена."
echo "📝 Бэкап сохранен в: $BACKUP_FILE"
ENDSSH

echo ""
echo "🎉 Скрипт выполнен!"

