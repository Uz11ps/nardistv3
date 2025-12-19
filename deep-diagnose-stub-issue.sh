#!/bin/bash

# Глубокая диагностика проблемы с заглушкой

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔍 Глубокая диагностика проблемы с заглушкой..."
echo ""

# 1. Проверяем frontend
echo "1️⃣ Проверка frontend контейнера..."
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "   ✅ Frontend доступен на localhost:5173"
    FRONTEND_CONTENT=$(curl -s http://localhost:5173 | head -5)
    echo "   Первые строки frontend:"
    echo "$FRONTEND_CONTENT" | sed 's/^/      /'
else
    echo "   ❌ Frontend НЕ доступен (код: $FRONTEND_TEST)"
    echo "   Это может быть причиной!"
fi

echo ""

# 2. Проверяем, может ли nginx подключиться к frontend
echo "2️⃣ Тест подключения nginx к frontend..."
# Запускаем curl от имени пользователя nginx
if id www-data >/dev/null 2>&1; then
    NGINX_TEST=$(sudo -u www-data curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173 2>&1)
    if [ "$NGINX_TEST" = "200" ]; then
        echo "   ✅ Nginx может подключиться к frontend"
    else
        echo "   ❌ Nginx НЕ может подключиться к frontend (код: $NGINX_TEST)"
        echo "   Это может быть причиной заглушки!"
    fi
else
    echo "   ⚠️ Пользователь www-data не найден"
fi

echo ""

# 3. Проверяем все server блоки в конфиге
echo "3️⃣ Анализ всех server блоков..."
ALL_SERVERS=$(grep -n "^[[:space:]]*server {" "$CONFIG_FILE")
echo "   Найдено server блоков:"
echo "$ALL_SERVERS" | sed 's/^/      /'
echo ""

# Показываем все server блоки подробно
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
    
    # Ключевая информация
    LISTEN_LINES=$(echo "$SERVER_BLOCK" | grep "listen")
    SERVER_NAME=$(echo "$SERVER_BLOCK" | grep "server_name")
    
    echo "      listen:"
    echo "$LISTEN_LINES" | sed 's/^/         /'
    echo "      server_name:"
    echo "$SERVER_NAME" | sed 's/^/         /'
    
    # Проверяем default_server
    if echo "$LISTEN_LINES" | grep -q "default_server"; then
        echo "      ⚠️ Имеет default_server - может перехватывать запросы!"
    fi
    
    # Проверяем root
    if echo "$SERVER_BLOCK" | grep -q "^[[:space:]]*root"; then
        ROOT_LINE=$(echo "$SERVER_BLOCK" | grep "^[[:space:]]*root" | head -1)
        echo "      ❌ Имеет root: $ROOT_LINE"
    fi
    
    # Проверяем location /
    if echo "$SERVER_BLOCK" | grep -q "location /"; then
        LOC_ROOT=$(echo "$SERVER_BLOCK" | grep -A 3 "location / {" | head -4)
        if echo "$LOC_ROOT" | grep -q "proxy_pass.*5173"; then
            echo "      ✅ location / проксирует на 5173"
        else
            echo "      ❌ location / НЕ проксирует на 5173!"
            echo "$LOC_ROOT" | sed 's/^/         /'
        fi
    else
        echo "      ❌ НЕТ location / блока!"
    fi
    
    echo ""
done < <(grep -n "^[[:space:]]*server {" "$CONFIG_FILE" | cut -d: -f1)

echo ""

# 4. Проверяем логи nginx
echo "4️⃣ Проверка логов nginx..."
ERROR_LOG="/var/log/nginx/error.log"
if [ -f "$ERROR_LOG" ]; then
    echo "   Последние ошибки:"
    tail -20 "$ERROR_LOG" | grep -i "error\|warn\|upstream\|connect" | tail -10 | sed 's/^/      /'
fi

ACCESS_LOG="/var/log/nginx/access.log"
if [ -f "$ACCESS_LOG" ]; then
    echo "   Последние запросы:"
    tail -5 "$ACCESS_LOG" | sed 's/^/      /'
fi

echo ""

# 5. Проверяем, нет ли других конфигов
echo "5️⃣ Поиск других конфигурационных файлов..."
OTHER_CONFIGS=$(find /etc/nginx -type f -name "*.conf" 2>/dev/null | xargs grep -l "server_name.*${DOMAIN}" 2>/dev/null | grep -v "$CONFIG_FILE")
if [ -n "$OTHER_CONFIGS" ]; then
    echo "   ⚠️ Найдены другие конфиги с server_name ${DOMAIN}:"
    echo "$OTHER_CONFIGS" | sed 's/^/      /'
    echo "   Они могут переопределять конфигурацию!"
else
    echo "   ✅ Других конфигов не найдено"
fi

echo ""

# 6. Проверяем include директивы
echo "6️⃣ Проверка include директив..."
INCLUDES=$(grep -n "include" "$CONFIG_FILE" | grep -v "^#")
if [ -n "$INCLUDES" ]; then
    echo "   ⚠️ Найдены include директивы:"
    echo "$INCLUDES" | sed 's/^/      /'
    echo "   Они могут подключать другую конфигурацию!"
    
    # Показываем содержимое includes
    while IFS= read -r include_line; do
        LINE_NUM=$(echo "$include_line" | cut -d: -f1)
        INCLUDE_PATH=$(echo "$include_line" | sed 's/.*include[[:space:]]*//' | sed "s/;//")
        if [ -f "$INCLUDE_PATH" ]; then
            echo "      Файл $INCLUDE_PATH существует и содержит:"
            head -20 "$INCLUDE_PATH" | sed 's/^/         /'
        fi
    done <<< "$INCLUDES"
else
    echo "   ✅ include директив не найдено"
fi

echo ""

# 7. Тест прямого проксирования
echo "7️⃣ Тест прямого проксирования через nginx..."
# Создаем тестовый запрос
TEST_RESPONSE=$(curl -k -s -H "Host: ${DOMAIN}" https://127.0.0.1/ 2>&1 | head -10)
if echo "$TEST_RESPONSE" | grep -qi "Website.*ready"; then
    echo "   ❌ Даже через 127.0.0.1 возвращается заглушка"
    echo "   Это значит проблема в конфигурации nginx"
else
    echo "   ✅ Через 127.0.0.1 заглушки нет"
fi

echo ""

# 8. Рекомендации
echo "=========================================="
echo "📋 Рекомендации:"
echo ""

if [ "$FRONTEND_TEST" != "200" ]; then
    echo "❌ Frontend недоступен - это основная проблема!"
    echo "   Решение:"
    echo "   docker-compose restart frontend"
    echo "   docker-compose logs frontend"
    echo ""
fi

if [ -n "$OTHER_CONFIGS" ]; then
    echo "⚠️ Найдены другие конфиги - они могут переопределять настройки"
    echo "   Решение: удалите или отключите их"
    echo ""
fi

if [ -n "$INCLUDES" ]; then
    echo "⚠️ Найдены include директивы - проверьте их содержимое"
    echo ""
fi

echo "Попробуйте также:"
echo "   1. Полностью перезапустить nginx: systemctl restart nginx"
echo "   2. Очистить кэш браузера (Ctrl+Shift+Delete)"
echo "   3. Проверить в инкогнито режиме"
echo "   4. Проверить логи в реальном времени: tail -f /var/log/nginx/error.log"

echo ""
echo "✅ Диагностика завершена!"

