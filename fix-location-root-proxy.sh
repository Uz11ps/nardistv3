#!/bin/bash

# Скрипт для исправления location / - должен проксировать на frontend (5173), а не backend (3000)

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Исправление location / - должен проксировать на frontend..."
echo ""

# Создаём бэкап
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "📦 Создан бэкап: $BACKUP_FILE"
echo ""

# Находим HTTPS server блок
HTTPS_BLOCK_START=$(grep -n "listen.*443" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -z "$HTTPS_BLOCK_START" ]; then
    echo "❌ HTTPS server блок не найден!"
    exit 1
fi

# Находим начало и конец server блока
SERVER_START=$HTTPS_BLOCK_START
while [ "$SERVER_START" -gt 0 ]; do
    if grep -q "^[[:space:]]*server {" <(sed -n "${SERVER_START}p" "$CONFIG_FILE" 2>/dev/null); then
        break
    fi
    SERVER_START=$((SERVER_START - 1))
done

SERVER_END=$SERVER_START
INDENT=$(sed -n "${SERVER_START}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
INDENT=$((INDENT - 1))

TOTAL_LINES=$(wc -l < "$CONFIG_FILE")
for i in $(seq $((SERVER_START + 1)) $TOTAL_LINES); do
    line=$(sed -n "${i}p" "$CONFIG_FILE")
    line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
    line_indent=$((line_indent - 1))
    
    if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
        SERVER_END=$i
        break
    fi
done

echo "✅ HTTPS server блок найден (строки $SERVER_START-$SERVER_END)"
echo ""

# Находим location / блок
LOCATION_ROOT_START=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE" | grep -n "^[[:space:]]*location / {" | head -1 | cut -d: -f1)
LOCATION_ROOT_START=$((SERVER_START + LOCATION_ROOT_START - 1))

if [ -z "$LOCATION_ROOT_START" ] || [ "$LOCATION_ROOT_START" -lt "$SERVER_START" ]; then
    echo "❌ location / блок не найден в HTTPS блоке!"
    exit 1
fi

echo "✅ location / блок найден на строке $LOCATION_ROOT_START"
echo ""

# Находим конец location / блока
LOCATION_ROOT_END=$LOCATION_ROOT_START
LOCATION_INDENT=$(sed -n "${LOCATION_ROOT_START}p" "$CONFIG_FILE" | sed 's/location.*//' | wc -c)
LOCATION_INDENT=$((LOCATION_INDENT - 1))

for i in $(seq $((LOCATION_ROOT_START + 1)) $SERVER_END); do
    line=$(sed -n "${i}p" "$CONFIG_FILE")
    line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
    line_indent=$((line_indent - 1))
    
    if [ "$line_indent" -le "$LOCATION_INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
        LOCATION_ROOT_END=$i
        break
    fi
done

echo "✅ location / блок заканчивается на строке $LOCATION_ROOT_END"
echo ""

# Проверяем текущий proxy_pass
CURRENT_PROXY=$(sed -n "${LOCATION_ROOT_START},${LOCATION_ROOT_END}p" "$CONFIG_FILE" | grep "proxy_pass")
echo "Текущий proxy_pass в location /:"
echo "$CURRENT_PROXY" | sed 's/^/   /'

if echo "$CURRENT_PROXY" | grep -q "127.0.0.1:5173"; then
    echo ""
    echo "✅ proxy_pass уже правильный (5173)"
    exit 0
fi

echo ""
echo "⚠️ proxy_pass указывает на неправильный порт!"
echo "Исправляю на 127.0.0.1:5173..."
echo ""

# Заменяем proxy_pass на правильный
sed -i "${LOCATION_ROOT_START},${LOCATION_ROOT_END}s|proxy_pass http://127.0.0.1:3000;|proxy_pass http://127.0.0.1:5173;|g" "$CONFIG_FILE"
sed -i "${LOCATION_ROOT_START},${LOCATION_ROOT_END}s|proxy_pass http://localhost:3000;|proxy_pass http://127.0.0.1:5173;|g" "$CONFIG_FILE"
sed -i "${LOCATION_ROOT_START},${LOCATION_ROOT_END}s|proxy_pass http://localhost:5173;|proxy_pass http://127.0.0.1:5173;|g" "$CONFIG_FILE"

# Проверяем результат
NEW_PROXY=$(sed -n "${LOCATION_ROOT_START},${LOCATION_ROOT_END}p" "$CONFIG_FILE" | grep "proxy_pass")
echo "Новый proxy_pass в location /:"
echo "$NEW_PROXY" | sed 's/^/   /'

if echo "$NEW_PROXY" | grep -q "127.0.0.1:5173"; then
    echo ""
    echo "✅ proxy_pass исправлен!"
else
    echo ""
    echo "❌ Не удалось исправить автоматически"
    echo "Исправьте вручную в строке $LOCATION_ROOT_START-$LOCATION_ROOT_END"
    exit 1
fi

echo ""

# Проверяем синтаксис
echo "🔍 Проверка синтаксиса nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен!"
    echo ""
    
    echo "🔄 Перезагрузка nginx..."
    systemctl reload nginx || service nginx reload
    sleep 2
    echo ""
    
    echo "🧪 Тестирование..."
    sleep 1
    
    HTTPS_TEST=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/ 2>&1)
    if [ "$HTTPS_TEST" = "200" ]; then
        echo "   ✅ HTTPS главная страница работает (код: $HTTPS_TEST)"
        
        # Проверяем, что это не заглушка
        MAIN_CONTENT=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -20)
        if echo "$MAIN_CONTENT" | grep -qi "заглушка\|welcome\|default\|ispmanager\|только что создан"; then
            echo "   ⚠️ Все еще показывает заглушку"
        else
            echo "   ✅ Контент правильный (не заглушка)"
        fi
    elif [ "$HTTPS_TEST" = "502" ]; then
        echo "   ❌ Все еще 502 Bad Gateway"
        echo "   Проверьте, что frontend контейнер работает:"
        echo "   docker-compose ps frontend"
        echo "   curl http://localhost:5173"
    else
        echo "   ⚠️ HTTPS вернул код: $HTTPS_TEST"
    fi
    
    echo ""
    echo "✅ Исправление завершено!"
    
else
    echo "   ❌ Ошибка в синтаксисе!"
    nginx -t 2>&1 | sed 's/^/      /'
    echo ""
    echo "🔄 Восстановление из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

