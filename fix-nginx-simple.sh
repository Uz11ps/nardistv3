#!/bin/bash

# Простой скрипт для замены location / на проксирование

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

set -e

echo "🔧 Простое исправление конфигурации Nginx..."

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
echo "✅ Найдена строка $MAIN_LOCATION_LINE"

# Находим закрывающую скобку location / простым способом
# Ищем строку с } и отступом в 4 пробела после location /
LOCATION_CLOSE=""
LINE_NUM=$((MAIN_LOCATION_LINE + 1))
while IFS= read -r line; do
    # Проверяем отступ (первые 4 символа должны быть пробелами, затем })
    if [[ "$line" =~ ^[[:space:]]{4}\}$ ]]; then
        LOCATION_CLOSE=$LINE_NUM
        break
    fi
    LINE_NUM=$((LINE_NUM + 1))
done < <(tail -n +$((MAIN_LOCATION_LINE + 1)) "$CONFIG_FILE")

if [ -z "$LOCATION_CLOSE" ]; then
    # Пробуем найти любую закрывающую скобку с отступом
    LOCATION_CLOSE=$(awk -v line="$MAIN_LOCATION_LINE" 'NR > line && /^[[:space:]]{4}\}$/ {print NR; exit}' "$CONFIG_FILE")
fi

if [ -z "$LOCATION_CLOSE" ]; then
    echo "❌ Не найдена закрывающая скобка location /"
    echo "Показываем структуру:"
    sed -n "$MAIN_LOCATION_LINE,$((MAIN_LOCATION_LINE+15))p" "$CONFIG_FILE"
    exit 1
fi

echo "✅ Закрывающая скобка location / на строке $LOCATION_CLOSE"

# Показываем структуру
echo "Структура location /:"
sed -n "$MAIN_LOCATION_LINE,$LOCATION_CLOSE p" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 4: Замена location / на проксирование..."

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до location /
head -n $((MAIN_LOCATION_LINE - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем новый location / с проксированием
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

