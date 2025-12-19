#!/bin/bash

# Финальная версия скрипта с правильной обработкой вложенных location

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

set -e

echo "🔧 Финальное исправление конфигурации Nginx..."

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
echo "📝 Шаг 3: Проверка существующих location блоков..."
if grep -q "^[[:space:]]*location /api" "$CONFIG_FILE"; then
    echo "⚠️ location /api уже существует"
    # Удаляем существующие location блоки для API
    sed -i '/^[[:space:]]*location \/api {/,/^[[:space:]]*}/d' "$CONFIG_FILE"
    sed -i '/^[[:space:]]*location \/socket.io {/,/^[[:space:]]*}/d' "$CONFIG_FILE"
    sed -i '/^[[:space:]]*location \/health {/,/^[[:space:]]*}/d' "$CONFIG_FILE"
    echo "✅ Старые location блоки удалены"
fi

echo ""
echo "📝 Шаг 4: Поиск места для вставки location блоков..."

# Находим строку с основным location / (строка 18 по выводу пользователя)
# Но нужно найти её динамически
MAIN_LOCATION_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -z "$MAIN_LOCATION_LINE" ]; then
    # Пробуем найти location / без фигурной скобки на той же строке
    MAIN_LOCATION_LINE=$(grep -n "^[[:space:]]*location /" "$CONFIG_FILE" | grep -v "location ~" | head -1 | cut -d: -f1)
fi

if [ -z "$MAIN_LOCATION_LINE" ]; then
    echo "❌ Не найдена строка с location /"
    echo "Структура файла:"
    grep -n "location" "$CONFIG_FILE" | head -10
    exit 1
fi

echo "✅ Найдена строка $MAIN_LOCATION_LINE"

# Определяем отступ (количество пробелов перед location /)
INDENT_STRING=$(sed -n "${MAIN_LOCATION_LINE}p" "$CONFIG_FILE" | sed 's/[^ ].*//')
INDENT=${#INDENT_STRING}

echo "📝 Отступ: $INDENT пробелов"

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до location /
head -n $((MAIN_LOCATION_LINE - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем location блоки с правильным отступом
printf "%${INDENT}s" "" | read SPACES
SPACES=$(printf "%${INDENT}s" "")

cat >> "$TMP_FILE" << EOF
${SPACES}location /api {
${SPACES}    proxy_pass http://127.0.0.1:3000;
${SPACES}    proxy_http_version 1.1;
${SPACES}    proxy_set_header Upgrade \$http_upgrade;
${SPACES}    proxy_set_header Connection 'upgrade';
${SPACES}    proxy_set_header Host \$host;
${SPACES}    proxy_set_header X-Real-IP \$remote_addr;
${SPACES}    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SPACES}    proxy_set_header X-Forwarded-Proto \$scheme;
${SPACES}    proxy_cache_bypass \$http_upgrade;
${SPACES}    proxy_redirect off;
${SPACES}}

${SPACES}location /socket.io {
${SPACES}    proxy_pass http://127.0.0.1:3000;
${SPACES}    proxy_http_version 1.1;
${SPACES}    proxy_set_header Upgrade \$http_upgrade;
${SPACES}    proxy_set_header Connection "upgrade";
${SPACES}    proxy_set_header Host \$host;
${SPACES}    proxy_set_header X-Real-IP \$remote_addr;
${SPACES}    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SPACES}    proxy_set_header X-Forwarded-Proto \$scheme;
${SPACES}}

${SPACES}location /health {
${SPACES}    proxy_pass http://127.0.0.1:3000/health;
${SPACES}    access_log off;
${SPACES}}

EOF

# Добавляем остальную часть файла
tail -n +$MAIN_LOCATION_LINE "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем оригинальный файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Location блоки добавлены"

echo ""
echo "📝 Шаг 5: Проверка синтаксиса..."
if nginx -t 2>&1 | tee /tmp/nginx_test.log; then
    echo "✅ Синтаксис корректен"
else
    echo "❌ Ошибка в синтаксисе!"
    echo "Детали ошибки:"
    cat /tmp/nginx_test.log
    echo ""
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
curl -s http://nardist.site 2>&1 | head -5
echo ""
echo "Backend API:"
curl -s http://nardist.site/api/health 2>&1

echo ""
echo "✅ Готово!"

