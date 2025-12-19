#!/bin/bash

# Правильный скрипт для исправления конфигурации Nginx

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

set -e

echo "🔧 Правильное исправление конфигурации Nginx..."

echo "📝 Шаг 1: Создание бэкапа..."
if [ ! -f "$BACKUP_FILE" ]; then
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo "✅ Бэкап создан"
else
    echo "✅ Восстанавливаем из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
fi

echo ""
echo "📝 Шаг 2: Изменение @fallback для проксирования на frontend..."
sed -i 's|proxy_pass http://127.0.0.1:8080;|proxy_pass http://127.0.0.1:5173;|g' "$CONFIG_FILE"
sed -i 's|proxy_redirect http://127.0.0.1:8080 /;|proxy_redirect http://127.0.0.1:5173 /;|g' "$CONFIG_FILE"
echo "✅ @fallback изменен"

echo ""
echo "📝 Шаг 3: Удаление существующих location блоков для API..."
sed -i '/^[[:space:]]*location \/api {/,/^[[:space:]]*}/d' "$CONFIG_FILE"
sed -i '/^[[:space:]]*location \/socket.io {/,/^[[:space:]]*}/d' "$CONFIG_FILE"
sed -i '/^[[:space:]]*location \/health {/,/^[[:space:]]*}/d' "$CONFIG_FILE"
echo "✅ Старые location блоки удалены"

echo ""
echo "📝 Шаг 4: Поиск места для вставки..."

# Находим строку с location / (строка 18)
MAIN_LOCATION_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -z "$MAIN_LOCATION_LINE" ]; then
    echo "❌ Не найдена строка с location /"
    exit 1
fi

echo "✅ Найдена строка $MAIN_LOCATION_LINE"

# Находим строку ПЕРЕД location / (где заканчиваются предыдущие директивы)
# Ищем строку перед location / которая не является пустой и не является комментарием
PREV_LINE=$((MAIN_LOCATION_LINE - 1))

# Показываем контекст
echo "Контекст вокруг location /:"
sed -n "$((PREV_LINE-2)),$((MAIN_LOCATION_LINE+2))p" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 5: Добавление location блоков ПЕРЕД location /..."

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до location / (включая пустые строки перед ним)
head -n $PREV_LINE "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем пустую строку и location блоки с правильным отступом (4 пробела)
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

EOF

# Добавляем остальную часть файла начиная со строки location /
tail -n +$MAIN_LOCATION_LINE "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем оригинальный файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Location блоки добавлены"

echo ""
echo "📝 Шаг 6: Проверка структуры..."
echo "Все location блоки:"
grep -n "location" "$CONFIG_FILE" | head -10

echo ""
echo "📝 Шаг 7: Проверка синтаксиса..."
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен"
else
    echo "❌ Ошибка в синтаксисе!"
    echo "Восстанавливаем из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

echo ""
echo "📝 Шаг 8: Перезагрузка Nginx..."
systemctl reload nginx
echo "✅ Nginx перезагружен"

echo ""
echo "⏳ Ожидание 3 секунды..."
sleep 3

echo ""
echo "📝 Шаг 9: Проверка работы..."
echo "Frontend:"
curl -s http://nardist.site 2>&1 | head -5
echo ""
echo "Backend API:"
curl -s http://nardist.site/api/health 2>&1

echo ""
echo "✅ Готово!"

