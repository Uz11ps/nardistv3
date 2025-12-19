#!/bin/bash

# Финальный рабочий скрипт

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

set -e

echo "🔧 Финальное исправление конфигурации Nginx..."

echo "📝 Шаг 1: Восстановление из бэкапа..."
cp "$BACKUP_FILE" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 2: Изменение @fallback для проксирования на frontend..."
sed -i 's|proxy_pass http://127.0.0.1:8080;|proxy_pass http://127.0.0.1:5173;|g' "$CONFIG_FILE"
sed -i 's|proxy_redirect http://127.0.0.1:8080 /;|proxy_redirect http://127.0.0.1:5173 /;|g' "$CONFIG_FILE"
echo "✅ @fallback изменен"

echo ""
echo "📝 Шаг 3: Поиск строки с location /..."
MAIN_LOCATION_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)
echo "✅ Найдена строка $MAIN_LOCATION_LINE"

# Показываем контекст
echo "Контекст:"
sed -n "$((MAIN_LOCATION_LINE-3)),$((MAIN_LOCATION_LINE+1))p" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 4: Добавление location блоков ПЕРЕД location /..."

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё ДО location / (не включая его)
head -n $((MAIN_LOCATION_LINE - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем location блоки с правильным отступом (4 пробела как в оригинале)
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

# Добавляем остальную часть файла НАЧИНАЯ со строки location /
tail -n +$MAIN_LOCATION_LINE "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем оригинальный файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Location блоки добавлены"

echo ""
echo "📝 Шаг 5: Проверка структуры..."
echo "Все location блоки на верхнем уровне:"
grep -n "^[[:space:]]*location" "$CONFIG_FILE" | grep -v "^[[:space:]]*[[:space:]]*location"

echo ""
echo "📝 Шаг 6: Проверка синтаксиса..."
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен"
else
    echo "❌ Ошибка в синтаксисе!"
    echo "Показываем проблемные строки:"
    grep -n "location /" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health"
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

