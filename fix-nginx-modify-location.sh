#!/bin/bash

# Скрипт для изменения location / чтобы он проксировал на frontend

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

set -e

echo "🔧 Изменение location / для проксирования на frontend..."

echo "📝 Шаг 1: Восстановление из бэкапа..."
cp "$BACKUP_FILE" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 2: Изменение @fallback для проксирования на frontend..."
sed -i 's|proxy_pass http://127.0.0.1:8080;|proxy_pass http://127.0.0.1:5173;|g' "$CONFIG_FILE"
sed -i 's|proxy_redirect http://127.0.0.1:8080 /;|proxy_redirect http://127.0.0.1:5173 /;|g' "$CONFIG_FILE"
echo "✅ @fallback изменен"

echo ""
echo "📝 Шаг 3: Поиск location /..."
MAIN_LOCATION_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -z "$MAIN_LOCATION_LINE" ]; then
    echo "❌ Не найдена строка с location /"
    exit 1
fi

echo "✅ Найдена строка $MAIN_LOCATION_LINE"

# Находим закрывающую скобку location /
# Ищем строку с отступом меньше чем у location / и закрывающей скобкой
LOCATION_CLOSE=$(awk -v line="$MAIN_LOCATION_LINE" '
BEGIN { start_line = line }
NR > start_line {
    # Определяем отступ location /
    if (NR == start_line + 1) {
        # Отступ location / - это количество пробелов перед location
        getline prev_line < "/dev/stdin"
        # Но мы уже прошли эту строку, нужно по-другому
    }
    # Ищем закрывающую скобку с отступом как у location /
    spaces = length($0) - length($1)
    if ($1 == "}" && spaces == 4) {
        print NR
        exit
    }
}
' "$CONFIG_FILE")

# Более простой способ - найдём строку с } и отступом в 4 пробела после location /
LOCATION_CLOSE=$(awk -v line="$MAIN_LOCATION_LINE" '
NR > line {
    spaces = length($0) - length($1)
    if ($1 == "}" && spaces == 4) {
        print NR
        exit
    }
}
' "$CONFIG_FILE")

if [ -z "$LOCATION_CLOSE" ]; then
    # Пробуем найти любую закрывающую скобку после location /
    LOCATION_CLOSE=$(awk -v line="$MAIN_LOCATION_LINE" 'NR > line && /^[[:space:]]*}$/ {print NR; exit}' "$CONFIG_FILE")
fi

echo "✅ Закрывающая скобка location / на строке $LOCATION_CLOSE"

# Показываем структуру location /
echo "Структура location /:"
sed -n "$MAIN_LOCATION_LINE,$LOCATION_CLOSE p" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 4: Замена содержимого location / на проксирование..."

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до location /
head -n $((MAIN_LOCATION_LINE - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем новый location / с проксированием на frontend
cat >> "$TMP_FILE" << 'EOF'
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

# Добавляем остальную часть файла после закрывающей скобки location /
tail -n +$((LOCATION_CLOSE + 1)) "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем оригинальный файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Location / заменён на проксирование"

echo ""
echo "📝 Шаг 5: Проверка структуры..."
echo "Все location блоки:"
grep -n "^[[:space:]]*location" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 6: Проверка синтаксиса..."
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен"
else
    echo "❌ Ошибка в синтаксисе!"
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

