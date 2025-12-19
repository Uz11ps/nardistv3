#!/bin/bash

# Скрипт для удаления root и index директив из HTTPS блока

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Удаление root и index директив из HTTPS блока..."
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

# Получаем HTTPS блок
HTTPS_BLOCK=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")

# Проверяем наличие root и index
ROOT_FOUND=0
INDEX_FOUND=0

if echo "$HTTPS_BLOCK" | grep -q "^[[:space:]]*root\|^[[:space:]]*root "; then
    ROOT_FOUND=1
    echo "⚠️ Найдена директива root в HTTPS блоке:"
    echo "$HTTPS_BLOCK" | grep "^[[:space:]]*root" | sed 's/^/   /'
fi

if echo "$HTTPS_BLOCK" | grep -q "^[[:space:]]*index\|^[[:space:]]*index "; then
    INDEX_FOUND=1
    echo "⚠️ Найдена директива index в HTTPS блоке:"
    echo "$HTTPS_BLOCK" | grep "^[[:space:]]*index" | sed 's/^/   /'
fi

if [ "$ROOT_FOUND" -eq 0 ] && [ "$INDEX_FOUND" -eq 0 ]; then
    echo "✅ root и index директивы не найдены в HTTPS блоке"
    echo ""
    echo "Проверяю другие возможные причины заглушки..."
    
    # Проверяем, может быть есть try_files в location /
    LOCATION_ROOT=$(echo "$HTTPS_BLOCK" | grep -A 20 "location / {" | head -20)
    if echo "$LOCATION_ROOT" | grep -q "try_files"; then
        echo "⚠️ Найдена директива try_files в location /:"
        echo "$LOCATION_ROOT" | grep "try_files" | sed 's/^/   /'
        echo "   Это может вызывать заглушку"
    fi
    
    # Проверяем proxy_pass
    if ! echo "$LOCATION_ROOT" | grep -q "proxy_pass.*5173"; then
        echo "⚠️ proxy_pass на 5173 не найден в location /"
    else
        echo "✅ proxy_pass на 5173 найден"
    fi
    
    echo ""
    echo "Если заглушка все еще показывается, возможно:"
    echo "   1. Frontend контейнер не работает"
    echo "   2. Nginx кэширует старую конфигурацию"
    echo "   3. Есть другой server блок, который перехватывает запросы"
    
    exit 0
fi

echo ""
echo "Удаляю root и index директивы..."
echo ""

# Удаляем root и index из HTTPS блока (только на уровне server, не в location)
# Используем awk для правильной обработки
awk -v start="$SERVER_START" -v end="$SERVER_END" '
NR >= start && NR <= end {
    # Пропускаем root и index директивы на уровне server (не в location)
    if (/^[[:space:]]*root[[:space:]]/ || /^[[:space:]]*index[[:space:]]/) {
        # Проверяем, что мы не внутри location блока
        if (!in_location) {
            # Пропускаем эту строку
            next
        }
    }
    
    # Отслеживаем location блоки
    if (/^[[:space:]]*location[[:space:]]/) {
        in_location = 1
    }
    if (in_location && /^[[:space:]]*}/) {
        in_location = 0
    }
    
    print
    next
}
{ print }
' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

# Также удаляем через sed (более простой способ)
sed -i "${SERVER_START},${SERVER_END}s|^[[:space:]]*root[[:space:]].*$||g" "$CONFIG_FILE"
sed -i "${SERVER_START},${SERVER_END}s|^[[:space:]]*index[[:space:]].*$||g" "$CONFIG_FILE"

# Удаляем пустые строки (опционально, для чистоты)
sed -i '/^[[:space:]]*$/N;/^\n$/d' "$CONFIG_FILE"

echo "✅ root и index директивы удалены"
echo ""

# Проверяем результат
HTTPS_BLOCK_NEW=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")
if echo "$HTTPS_BLOCK_NEW" | grep -q "^[[:space:]]*root\|^[[:space:]]*index"; then
    echo "⚠️ root или index все еще присутствуют, удаляю принудительно..."
    # Более агрессивное удаление
    sed -i "${SERVER_START},${SERVER_END}{ /^[[:space:]]*root[[:space:]]/d; /^[[:space:]]*index[[:space:]]/d; }" "$CONFIG_FILE"
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
        echo "   ✅ HTTPS работает (код: $HTTPS_TEST)"
        
        # Проверяем контент
        MAIN_CONTENT=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -30)
        if echo "$MAIN_CONTENT" | grep -qi "заглушка\|welcome\|ispmanager\|только что создан\|приветствуем"; then
            echo "   ❌ Все еще показывает заглушку!"
            echo ""
            echo "   Проверяю frontend контейнер..."
            FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
            if [ "$FRONTEND_TEST" = "200" ]; then
                echo "   ✅ Frontend доступен на localhost:5173"
                echo ""
                echo "   Возможно, nginx кэширует или есть другой server блок"
                echo "   Проверьте конфигурацию вручную"
            else
                echo "   ❌ Frontend НЕ доступен на localhost:5173 (код: $FRONTEND_TEST)"
                echo "   Запустите: docker-compose up -d frontend"
            fi
        else
            echo "   ✅ Контент правильный (не заглушка)"
        fi
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

