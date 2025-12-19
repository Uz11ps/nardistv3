#!/bin/bash

# Скрипт для исправления проксирования frontend (версия 2 - без дубликатов)

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔧 Исправление проксирования frontend (версия 2)..."

# Создаём бэкап
if [ ! -f "$CONFIG_FILE.backup" ]; then
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    echo "✅ Бэкап создан"
fi

# Проверяем текущую конфигурацию
echo ""
echo "Текущие location блоки:"
grep -n "location /" "$CONFIG_FILE" | grep -v "^#"

# Проверяем что frontend контейнер работает
echo ""
echo "Проверка frontend контейнера:"
if curl -s http://127.0.0.1:5173 > /dev/null 2>&1; then
    echo "✅ Frontend контейнер отвечает на порту 5173"
else
    echo "⚠️ Frontend контейнер не отвечает на порту 5173"
    echo "Проверьте: docker-compose ps frontend"
fi

# Проверяем какие location блоки уже есть
HAS_API=$(grep -c "location /api {" "$CONFIG_FILE" || echo "0")
HAS_SOCKET=$(grep -c "location /socket.io {" "$CONFIG_FILE" || echo "0")
HAS_HEALTH=$(grep -c "location /health {" "$CONFIG_FILE" || echo "0")
HAS_ROOT=$(grep -c "^[[:space:]]*location / {" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" || echo "0")

echo ""
echo "Найденные location блоки:"
echo "  location /api: $HAS_API"
echo "  location /socket.io: $HAS_SOCKET"
echo "  location /health: $HAS_HEALTH"
echo "  location /: $HAS_ROOT"

# Находим location / (не /api, не /socket.io, не /health)
LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | head -1 | cut -d: -f1)

if [ -z "$LOC_LINE" ]; then
    echo "❌ Не найдена строка с location /"
    exit 1
fi

echo ""
echo "✅ location / найден на строке $LOC_LINE"

# Находим закрывающую скобку location /
LOCATION_CLOSE=""
INDENT=$(sed -n "${LOC_LINE}p" "$CONFIG_FILE" | sed 's/location.*//' | wc -c)
INDENT=$((INDENT - 1))

for i in $(seq $((LOC_LINE + 1)) $(wc -l < "$CONFIG_FILE")); do
    line=$(sed -n "${i}p" "$CONFIG_FILE")
    line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
    line_indent=$((line_indent - 1))
    
    if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
        LOCATION_CLOSE=$i
        break
    fi
done

if [ -z "$LOCATION_CLOSE" ]; then
    echo "❌ Не найдена закрывающая скобка location /"
    exit 1
fi

echo "✅ Закрывающая скобка location / на строке $LOCATION_CLOSE"

# Показываем структуру location /
echo ""
echo "Структура location /:"
sed -n "${LOC_LINE},${LOCATION_CLOSE}p" "$CONFIG_FILE"

echo ""
echo "📝 Замена location / на проксирование на frontend..."

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до location /
head -n $((LOC_LINE - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем location блоки только если их ещё нет
if [ "$HAS_API" -eq 0 ]; then
    echo "Добавляем location /api..."
    cat >> "$TMP_FILE" << 'EOF'
    location /api {
        rewrite ^/api(.*)$ $1 break;
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

EOF
fi

if [ "$HAS_SOCKET" -eq 0 ]; then
    echo "Добавляем location /socket.io..."
    cat >> "$TMP_FILE" << 'EOF'
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

EOF
fi

if [ "$HAS_HEALTH" -eq 0 ]; then
    echo "Добавляем location /health..."
    cat >> "$TMP_FILE" << 'EOF'
    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

EOF
fi

# Добавляем location / с проксированием на frontend
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

EOF

# Добавляем остальную часть файла после закрывающей скобки location /
tail -n +$((LOCATION_CLOSE + 1)) "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Конфигурация обновлена"

# Проверяем на дубликаты
echo ""
echo "Проверка дубликатов:"
API_COUNT=$(grep -c "location /api {" "$CONFIG_FILE" || echo "0")
SOCKET_COUNT=$(grep -c "location /socket.io {" "$CONFIG_FILE" || echo "0")
HEALTH_COUNT=$(grep -c "location /health {" "$CONFIG_FILE" || echo "0")
ROOT_COUNT=$(grep -c "^[[:space:]]*location / {" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" || echo "0")

echo "  location /api: $API_COUNT"
echo "  location /socket.io: $SOCKET_COUNT"
echo "  location /health: $HEALTH_COUNT"
echo "  location /: $ROOT_COUNT"

if [ "$API_COUNT" -gt 1 ] || [ "$SOCKET_COUNT" -gt 1 ] || [ "$HEALTH_COUNT" -gt 1 ] || [ "$ROOT_COUNT" -gt 1 ]; then
    echo ""
    echo "⚠️ Найдены дубликаты! Показываю все location блоки:"
    grep -n "location /" "$CONFIG_FILE" | grep -v "^#"
    echo ""
    echo "Нужно вручную удалить дубликаты или восстановить из бэкапа:"
    echo "  cp $CONFIG_FILE.backup $CONFIG_FILE"
    exit 1
fi

echo ""
echo "Проверка синтаксиса:"
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен!"
    
    echo ""
    echo "Перезагрузка Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "Ожидание 2 секунды..."
    sleep 2
    
    echo ""
    echo "Проверка работы frontend:"
    curl -s http://nardist.site | head -20
    echo ""
    
    echo ""
    echo "Проверка работы API:"
    curl -s http://nardist.site/api/health
    echo ""
else
    echo "❌ Ошибка в синтаксисе!"
    nginx -t 2>&1
    exit 1
fi

