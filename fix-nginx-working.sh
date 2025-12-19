#!/bin/bash

# Рабочий скрипт для исправления конфигурации Nginx

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

set -e

echo "🔧 Исправление конфигурации Nginx..."

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
echo "📝 Шаг 3: Удаление существующих location блоков для API (если есть)..."
# Удаляем существующие location блоки
sed -i '/^[[:space:]]*location \/api {/,/^[[:space:]]*}/d' "$CONFIG_FILE"
sed -i '/^[[:space:]]*location \/socket.io {/,/^[[:space:]]*}/d' "$CONFIG_FILE"
sed -i '/^[[:space:]]*location \/health {/,/^[[:space:]]*}/d' "$CONFIG_FILE"
echo "✅ Старые location блоки удалены (если были)"

echo ""
echo "📝 Шаг 4: Поиск места для вставки location блоков..."

# Находим строку с основным location / (строка 18)
MAIN_LOCATION_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -z "$MAIN_LOCATION_LINE" ]; then
    echo "❌ Не найдена строка с location /"
    exit 1
fi

echo "✅ Найдена строка $MAIN_LOCATION_LINE"

# Правильно определяем отступ - берём строку и считаем пробелы в начале
LOCATION_LINE_CONTENT=$(sed -n "${MAIN_LOCATION_LINE}p" "$CONFIG_FILE")
INDENT=$(echo "$LOCATION_LINE_CONTENT" | sed 's/\(^[[:space:]]*\).*/\1/' | wc -c)
INDENT=$((INDENT - 1))

echo "📝 Отступ: $INDENT пробелов"
echo "📝 Строка: '$LOCATION_LINE_CONTENT'"

# Создаём строку с отступом
SPACES=$(printf "%${INDENT}s" "")

echo ""
echo "📝 Шаг 5: Добавление location блоков..."

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до location /
head -n $((MAIN_LOCATION_LINE - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем location блоки с правильным отступом (4 пробела как в оригинале)
cat >> "$TMP_FILE" << EOF
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_redirect off;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }

EOF

# Добавляем остальную часть файла
tail -n +$MAIN_LOCATION_LINE "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем оригинальный файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Location блоки добавлены"

echo ""
echo "📝 Шаг 6: Проверка синтаксиса..."
if nginx -t 2>&1 | tee /tmp/nginx_test.log; then
    echo "✅ Синтаксис корректен"
else
    echo "❌ Ошибка в синтаксисе!"
    cat /tmp/nginx_test.log
    echo ""
    echo "Восстанавливаем из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

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

