#!/bin/bash

# Скрипт для исправления проксирования frontend

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔧 Исправление проксирования frontend..."

# Создаём бэкап
if [ ! -f "$CONFIG_FILE.backup" ]; then
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    echo "✅ Бэкап создан"
fi

# Проверяем текущую конфигурацию location /
echo ""
echo "Текущая конфигурация location /:"
grep -A 10 "location / {" "$CONFIG_FILE" | head -15

# Проверяем что frontend контейнер работает
echo ""
echo "Проверка frontend контейнера:"
if curl -s http://127.0.0.1:5173 > /dev/null 2>&1; then
    echo "✅ Frontend контейнер отвечает на порту 5173"
else
    echo "⚠️ Frontend контейнер не отвечает на порту 5173"
    echo "Проверьте: docker-compose ps frontend"
fi

# Находим location / (не /api, не /socket.io, не /health)
LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | head -1 | cut -d: -f1)

if [ -z "$LOC_LINE" ]; then
    echo "❌ Не найдена строка с location /"
    exit 1
fi

echo ""
echo "✅ location / найден на строке $LOC_LINE"

# Находим закрывающую скобку location /
# Ищем строку с } и отступом в 4 пробела после location /
LOCATION_CLOSE=""
INDENT=$(sed -n "${LOC_LINE}p" "$CONFIG_FILE" | sed 's/location.*//' | wc -c)
INDENT=$((INDENT - 1))

for i in $(seq $((LOC_LINE + 1)) $(wc -l < "$CONFIG_FILE")); do
    line=$(sed -n "${i}p" "$CONFIG_FILE")
    line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
    line_indent=$((line_indent - 1))
    
    # Если отступ меньше или равен отступу location / и есть закрывающая скобка
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

# Добавляем location блоки для API ПЕРЕД location /
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

    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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

# Заменяем файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Конфигурация обновлена"

# Проверяем на дубликаты
DUPLICATES=$(grep -n "location / {" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | wc -l)
if [ "$DUPLICATES" -gt 1 ]; then
    echo ""
    echo "⚠️ Найдены дубликаты location /:"
    grep -n "location / {" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health"
    echo ""
    echo "Проверка синтаксиса:"
    if nginx -t 2>&1; then
        echo "✅ Синтаксис корректен, но есть дубликаты"
    else
        echo "❌ Ошибка в синтаксисе!"
        nginx -t 2>&1
        exit 1
    fi
else
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
    else
        echo "❌ Ошибка в синтаксисе!"
        nginx -t 2>&1
        exit 1
    fi
fi

