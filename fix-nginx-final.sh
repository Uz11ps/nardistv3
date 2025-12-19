#!/bin/bash

# Финальный скрипт для полной замены server блока правильной конфигурацией

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔧 Полная замена server блока правильной конфигурацией..."

# Создаём бэкап
if [ ! -f "$CONFIG_FILE.backup" ]; then
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    echo "✅ Бэкап создан"
fi

# Проверяем что frontend контейнер работает
echo ""
echo "Проверка frontend контейнера:"
if curl -s http://127.0.0.1:5173 > /dev/null 2>&1; then
    echo "✅ Frontend контейнер отвечает на порту 5173"
else
    echo "⚠️ Frontend контейнер не отвечает на порту 5173"
    echo "Проверьте: docker-compose ps frontend"
fi

# Находим ВСЕ server блоки для nardist.site и обрабатываем каждый
SERVER_LINES=$(grep -n "server_name.*nardist.site" "$CONFIG_FILE" | cut -d: -f1)

for SERVER_LINE in $SERVER_LINES; do

if [ -z "$SERVER_LINE" ]; then
    echo "❌ Не найден server блок для nardist.site"
    exit 1
fi

# Находим начало server блока (может быть на предыдущих строках)
while [ "$SERVER_LINE" -gt 0 ]; do
    if grep -q "^[[:space:]]*server {" <(sed -n "${SERVER_LINE}p" "$CONFIG_FILE"); then
        break
    fi
    SERVER_LINE=$((SERVER_LINE - 1))
done

if [ "$SERVER_LINE" -eq 0 ]; then
    echo "❌ Не найдено начало server блока"
    exit 1
fi

echo "✅ server блок найден на строке $SERVER_LINE"

# Находим закрывающую скобку server блока
SERVER_CLOSE=""
INDENT=$(sed -n "${SERVER_LINE}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
INDENT=$((INDENT - 1))

for i in $(seq $((SERVER_LINE + 1)) $(wc -l < "$CONFIG_FILE")); do
    line=$(sed -n "${i}p" "$CONFIG_FILE")
    line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
    line_indent=$((line_indent - 1))
    
    if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
        SERVER_CLOSE=$i
        break
    fi
done

if [ -z "$SERVER_CLOSE" ]; then
    echo "❌ Не найдена закрывающая скобка server блока"
    exit 1
fi

echo "✅ server блок заканчивается на строке $SERVER_CLOSE"

# Сохраняем начало файла до server блока
BEFORE_SERVER=$(head -n $((SERVER_LINE - 1)) "$CONFIG_FILE")

# Сохраняем конец файла после server блока
AFTER_SERVER=$(tail -n +$((SERVER_CLOSE + 1)) "$CONFIG_FILE")

# Получаем отступ для server блока
SERVER_INDENT=$(sed -n "${SERVER_LINE}p" "$CONFIG_FILE" | sed 's/server.*//')

# Получаем ВСЕ настройки из существующего server блока, кроме location блоков
SERVER_BLOCK=$(sed -n "${SERVER_LINE},${SERVER_CLOSE}p" "$CONFIG_FILE")

# Сохраняем все строки кроме location блоков
ALL_SETTINGS=""
IN_LOCATION=0
LOCATION_INDENT=0

while IFS= read -r line; do
    # Пропускаем открывающую и закрывающую скобки server блока
    if echo "$line" | grep -q "^[[:space:]]*server {" || echo "$line" | grep -q "^[[:space:]]*}$"; then
        continue
    fi
    
    # Проверяем начало location блока
    if echo "$line" | grep -q "^[[:space:]]*location "; then
        IN_LOCATION=1
        LOCATION_INDENT=$(echo "$line" | sed 's/location.*//' | wc -c)
        LOCATION_INDENT=$((LOCATION_INDENT - 1))
        continue
    fi
    
    # Если мы внутри location блока, проверяем закрывающую скобку
    if [ "$IN_LOCATION" -eq 1 ]; then
        line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
        line_indent=$((line_indent - 1))
        
        if [ "$line_indent" -le "$LOCATION_INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
            IN_LOCATION=0
        fi
        continue
    fi
    
    # Сохраняем строку если мы не внутри location блока
    ALL_SETTINGS="${ALL_SETTINGS}${line}\n"
done <<< "$SERVER_BLOCK"

# Убираем последний перенос строки
ALL_SETTINGS=$(echo -e "$ALL_SETTINGS" | sed '$d')

# Создаём временный файл
TMP_FILE=$(mktemp)

# Добавляем начало файла
echo "$BEFORE_SERVER" > "$TMP_FILE"

# Добавляем начало server блока с отступом
echo -n "$SERVER_INDENT" >> "$TMP_FILE"
echo "server {" >> "$TMP_FILE"

# Добавляем все сохранённые настройки
if [ -n "$ALL_SETTINGS" ]; then
    echo -e "$ALL_SETTINGS" >> "$TMP_FILE"
fi

# Добавляем location блоки для API
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

# Добавляем закрывающую скобку server блока
echo -n "$SERVER_INDENT" >> "$TMP_FILE"
echo "}" >> "$TMP_FILE"

# Добавляем остальную часть файла
echo "$AFTER_SERVER" >> "$TMP_FILE"

# Заменяем файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Конфигурация обновлена"

# Проверяем синтаксис
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
    
    echo ""
    echo "✅ Всё готово!"
else
    echo "❌ Ошибка в синтаксисе!"
    nginx -t 2>&1
    exit 1
fi
