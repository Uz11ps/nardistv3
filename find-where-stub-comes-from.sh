#!/bin/bash

# Скрипт для поиска, откуда берется заглушка ISPmanager

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔍 Поиск источника заглушки ISPmanager..."
echo ""

# 1. Проверяем, что реально отдает nginx
echo "1️⃣ Проверка реального ответа nginx..."
REAL_RESPONSE=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -50)
echo "Первые 50 строк ответа:"
echo "$REAL_RESPONSE" | head -20
echo ""

if echo "$REAL_RESPONSE" | grep -qi "ispmanager\|приветствуем\|только что создан"; then
    echo "   ❌ Это действительно заглушка ISPmanager!"
    echo ""
    
    # Проверяем, откуда она может браться
    if echo "$REAL_RESPONSE" | grep -qi "root_path\|www-root"; then
        echo "   ⚠️ В ответе упоминается root_path или www-root"
    fi
else
    echo "   ✅ Это не заглушка ISPmanager"
    exit 0
fi

echo ""

# 2. Проверяем все server блоки в конфигурации
echo "2️⃣ Анализ всех server блоков..."
TOTAL_SERVERS=$(grep -c "^[[:space:]]*server {" "$CONFIG_FILE" 2>/dev/null || echo "0")
echo "   Найдено server блоков: $TOTAL_SERVERS"
echo ""

# Показываем все server блоки
SERVER_NUM=0
while IFS= read -r line_num; do
    SERVER_NUM=$((SERVER_NUM + 1))
    echo "   Server блок #$SERVER_NUM (строка $line_num):"
    
    # Находим конец блока
    SERVER_START=$line_num
    SERVER_END=$line_num
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
    
    SERVER_BLOCK=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")
    
    # Показываем ключевые директивы
    echo "      listen: $(echo "$SERVER_BLOCK" | grep "listen" | head -2 | tr '\n' ' ')"
    echo "      server_name: $(echo "$SERVER_BLOCK" | grep "server_name" | head -1)"
    
    if echo "$SERVER_BLOCK" | grep -q "root"; then
        ROOT_DIR=$(echo "$SERVER_BLOCK" | grep "^[[:space:]]*root" | head -1)
        echo "      ⚠️ root: $ROOT_DIR"
    fi
    
    if echo "$SERVER_BLOCK" | grep -q "index"; then
        INDEX_DIR=$(echo "$SERVER_BLOCK" | grep "^[[:space:]]*index" | head -1)
        echo "      ⚠️ index: $INDEX_DIR"
    fi
    
    if echo "$SERVER_BLOCK" | grep -q "location /"; then
        LOCATION_ROOT=$(echo "$SERVER_BLOCK" | grep -A 5 "location / {" | head -6)
        if echo "$LOCATION_ROOT" | grep -q "proxy_pass"; then
            PROXY_PASS=$(echo "$LOCATION_ROOT" | grep "proxy_pass")
            echo "      ✅ location /: $PROXY_PASS"
        else
            echo "      ❌ location /: НЕТ proxy_pass!"
            if echo "$LOCATION_ROOT" | grep -q "try_files"; then
                echo "      ⚠️ Есть try_files - это может быть проблемой"
            fi
        fi
    else
        echo "      ❌ НЕТ location / блока!"
    fi
    
    echo ""
done < <(grep -n "^[[:space:]]*server {" "$CONFIG_FILE" | cut -d: -f1)

echo ""

# 3. Проверяем, какой server блок срабатывает для HTTPS
echo "3️⃣ Проверка приоритета server блоков..."
echo "   Nginx выбирает server блок по:"
echo "   1. Точное совпадение server_name"
echo "   2. Первый блок с default_server"
echo "   3. Первый блок с listen на нужном порту"
echo ""

# Проверяем default_server
DEFAULT_SERVERS=$(grep -n "default_server" "$CONFIG_FILE")
if [ -n "$DEFAULT_SERVERS" ]; then
    echo "   ⚠️ Найдены default_server:"
    echo "$DEFAULT_SERVERS" | sed 's/^/      /'
else
    echo "   ✅ default_server не найден"
fi

echo ""

# 4. Проверяем include директивы
echo "4️⃣ Проверка include директив..."
INCLUDES=$(grep -n "include" "$CONFIG_FILE")
if [ -n "$INCLUDES" ]; then
    echo "   ⚠️ Найдены include директивы:"
    echo "$INCLUDES" | sed 's/^/      /'
    echo "   Они могут подключать другую конфигурацию!"
else
    echo "   ✅ include директив не найдено"
fi

echo ""

# 5. Проверяем переменные типа $root_path
echo "5️⃣ Проверка переменных (root_path и т.д.)..."
if grep -q "\$root_path\|\$document_root" "$CONFIG_FILE"; then
    echo "   ⚠️ Найдены переменные root_path или document_root:"
    grep -n "\$root_path\|\$document_root" "$CONFIG_FILE" | sed 's/^/      /'
    echo "   Эти переменные могут указывать на заглушку ISPmanager!"
else
    echo "   ✅ Переменных root_path не найдено"
fi

echo ""

# 6. Проверяем, может быть есть другой конфигурационный файл
echo "6️⃣ Поиск других конфигурационных файлов для ${DOMAIN}..."
OTHER_CONFIGS=$(find /etc/nginx -name "*${DOMAIN}*" -o -name "*nardist*" 2>/dev/null | grep -v "$CONFIG_FILE")
if [ -n "$OTHER_CONFIGS" ]; then
    echo "   ⚠️ Найдены другие конфигурационные файлы:"
    echo "$OTHER_CONFIGS" | sed 's/^/      /'
    echo "   Они могут переопределять конфигурацию!"
else
    echo "   ✅ Других конфигурационных файлов не найдено"
fi

echo ""

# 7. Проверяем главный конфиг nginx
echo "7️⃣ Проверка главного конфига nginx..."
MAIN_CONFIG="/etc/nginx/nginx.conf"
if [ -f "$MAIN_CONFIG" ]; then
    echo "   Проверяю includes в главном конфиге..."
    MAIN_INCLUDES=$(grep -E "include.*vhost|include.*conf" "$MAIN_CONFIG" | grep -v "^#")
    if [ -n "$MAIN_INCLUDES" ]; then
        echo "   Найдены includes:"
        echo "$MAIN_INCLUDES" | sed 's/^/      /'
    fi
fi

echo ""

# 8. Рекомендации
echo "=========================================="
echo "📋 Рекомендации:"
echo ""

echo "Если заглушка все еще показывается:"
echo ""
echo "1. Убедитесь, что в HTTPS server блоке:"
echo "   - НЕТ директив root и index"
echo "   - ЕСТЬ location / с proxy_pass http://127.0.0.1:5173"
echo "   - location / идет ПОСЛЕДНИМ (чтобы не перехватывался другими)"
echo ""
echo "2. Проверьте порядок server блоков:"
echo "   - HTTPS блок должен быть первым или иметь правильный server_name"
echo ""
echo "3. Перезагрузите nginx полностью:"
echo "   systemctl restart nginx"
echo ""
echo "4. Очистите кэш браузера (Ctrl+Shift+Delete)"
echo ""
echo "5. Проверьте логи nginx:"
echo "   tail -f /var/log/nginx/error.log"
echo "   tail -f /var/log/nginx/access.log"

echo ""
echo "✅ Диагностика завершена!"

