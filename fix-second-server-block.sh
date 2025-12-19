#!/bin/bash

# Скрипт для исправления второго server блока

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Исправление второго server блока..."
echo ""

# Создаём бэкап
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "📦 Создан бэкап: $BACKUP_FILE"
echo ""

# Находим второй server блок
SECOND_SERVER_START=$(grep -n "^[[:space:]]*server {" "$CONFIG_FILE" | sed -n '2p' | cut -d: -f1)

if [ -z "$SECOND_SERVER_START" ]; then
    echo "❌ Второй server блок не найден!"
    exit 1
fi

echo "✅ Второй server блок найден на строке $SECOND_SERVER_START"
echo ""

# Находим конец второго server блока
SERVER_START=$SECOND_SERVER_START
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

echo "✅ Второй server блок заканчивается на строке $SERVER_END"
echo ""

# Показываем содержимое второго блока
SECOND_BLOCK=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")
echo "Содержимое второго server блока:"
echo "$SECOND_BLOCK" | sed 's/^/   /'
echo ""

# Проверяем, что это за блок
if echo "$SECOND_BLOCK" | grep -q "listen.*80"; then
    echo "   Это HTTP блок (порт 80)"
    echo "   Должен редиректить на HTTPS"
    
    # Проверяем, есть ли редирект
    if echo "$SECOND_BLOCK" | grep -q "return 301.*https"; then
        echo "   ✅ Редирект на HTTPS есть"
    else
        echo "   ❌ Редиректа на HTTPS нет, добавляю..."
        
        # Добавляем редирект перед закрывающей скобкой
        INSERT_LINE=$((SERVER_END - 1))
        SERVER_INDENT=$(sed -n "${SERVER_START}p" "$CONFIG_FILE" | sed 's/server.*//')
        
        TMP_FILE=$(mktemp)
        head -n $INSERT_LINE "$CONFIG_FILE" > "$TMP_FILE"
        
        cat >> "$TMP_FILE" << EOF
${SERVER_INDENT}    # Редирект на HTTPS
${SERVER_INDENT}    return 301 https://\$server_name\$request_uri;
EOF
        
        tail -n +$SERVER_END "$CONFIG_FILE" >> "$TMP_FILE"
        mv "$TMP_FILE" "$CONFIG_FILE"
        
        echo "   ✅ Редирект добавлен"
    fi
elif echo "$SECOND_BLOCK" | grep -q "listen.*443"; then
    echo "   ⚠️ Это второй HTTPS блок!"
    echo "   Это может вызывать конфликты"
    echo "   Удаляю его..."
    
    # Удаляем второй HTTPS блок
    sed -i "${SERVER_START},${SERVER_END}d" "$CONFIG_FILE"
    echo "   ✅ Второй HTTPS блок удален"
else
    echo "   ⚠️ Непонятный блок, удаляю..."
    sed -i "${SERVER_START},${SERVER_END}d" "$CONFIG_FILE"
    echo "   ✅ Блок удален"
fi

echo ""

# Проверяем синтаксис
echo "🔍 Проверка синтаксиса..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен"
    echo ""
    
    echo "🔄 Полная перезагрузка nginx..."
    systemctl restart nginx
    sleep 3
    
    if systemctl is-active --quiet nginx; then
        echo "   ✅ Nginx перезапущен"
        echo ""
        
        # Проверяем порты
        echo "🔍 Проверка портов..."
        if lsof -ti:443 >/dev/null 2>&1; then
            PORT_443_PID=$(lsof -ti:443 | head -1)
            PORT_443_PROC=$(ps -p $PORT_443_PID -o comm= 2>/dev/null || echo "unknown")
            if echo "$PORT_443_PROC" | grep -q "nginx"; then
                echo "   ✅ Порт 443 слушается nginx (PID: $PORT_443_PID)"
            else
                echo "   ⚠️ Порт 443 слушается процессом: $PORT_443_PROC"
            fi
        else
            echo "   ❌ Порт 443 не слушается!"
        fi
        
        echo ""
        echo "🧪 Тестирование..."
        sleep 2
        
        HTTPS_RESPONSE=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -10)
        if echo "$HTTPS_RESPONSE" | grep -qi "Website.*ready\|content is to be added\|ispmanager"; then
            echo "   ❌ Все еще заглушка!"
            echo ""
            echo "   Первые строки ответа:"
            echo "$HTTPS_RESPONSE" | head -5 | sed 's/^/      /'
        else
            echo "   ✅ Заглушка исчезла!"
            if echo "$HTTPS_RESPONSE" | grep -qi "Нарды\|vite\|root.*div"; then
                echo "   ✅ Это frontend приложение!"
            fi
        fi
    else
        echo "   ❌ Nginx не запустился!"
        journalctl -u nginx -n 20 --no-pager | tail -10
    fi
else
    echo "   ❌ Ошибка в синтаксисе!"
    nginx -t 2>&1 | sed 's/^/      /'
    echo ""
    echo "🔄 Восстановление из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

echo ""
echo "✅ Исправление завершено!"

