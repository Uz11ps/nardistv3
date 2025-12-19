#!/bin/bash

# Скрипт для проверки реальной проблемы с HTTPS

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔍 Проверка реальной проблемы с HTTPS..."
echo ""

# 1. Проверка с игнорированием SSL (чтобы увидеть реальный ответ)
echo "1️⃣ Проверка HTTPS с игнорированием SSL проверки..."
HTTPS_RESPONSE=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN} 2>&1)
echo "   Код ответа: $HTTPS_RESPONSE"
echo ""

if [ "$HTTPS_RESPONSE" = "502" ]; then
    echo "❌ Реальная проблема: 502 Bad Gateway"
    echo "   Это значит nginx не может подключиться к backend/frontend"
    echo ""
fi

# 2. Проверка логов nginx для HTTPS
echo "2️⃣ Проверка логов nginx для HTTPS..."
ERROR_LOG="/var/log/nginx/nardist.site_https_error.log"
if [ -f "$ERROR_LOG" ]; then
    echo "   Последние ошибки из $ERROR_LOG:"
    tail -20 "$ERROR_LOG" | sed 's/^/      /'
else
    echo "   ⚠️ Лог файл не найден: $ERROR_LOG"
    echo "   Проверяю общий лог ошибок..."
    tail -20 /var/log/nginx/error.log 2>/dev/null | grep -i "nardist\|502" | sed 's/^/      /' || echo "      Нет ошибок в общем логе"
fi
echo ""

# 3. Проверка доступности через localhost с HTTPS контекста
echo "3️⃣ Проверка доступности backend/frontend из контекста nginx..."
echo "   Backend (localhost:3000):"
BACKEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>&1)
if [ "$BACKEND_CHECK" = "200" ]; then
    echo "      ✅ Backend доступен"
else
    echo "      ❌ Backend недоступен (код: $BACKEND_CHECK)"
fi

echo "   Frontend (localhost:5173):"
FRONTEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
if [ "$FRONTEND_CHECK" = "200" ]; then
    echo "      ✅ Frontend доступен"
else
    echo "      ❌ Frontend недоступен (код: $FRONTEND_CHECK)"
fi
echo ""

# 4. Проверка реальной конфигурации HTTPS блока
echo "4️⃣ Проверка конфигурации HTTPS блока..."
HTTPS_BLOCK_START=$(grep -n "listen.*443" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -n "$HTTPS_BLOCK_START" ]; then
    # Находим server блок
    SERVER_START=$HTTPS_BLOCK_START
    while [ "$SERVER_START" -gt 0 ]; do
        if grep -q "^[[:space:]]*server {" <(sed -n "${SERVER_START}p" "$CONFIG_FILE" 2>/dev/null); then
            break
        fi
        SERVER_START=$((SERVER_START - 1))
    done
    
    # Находим конец блока
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
    
    HTTPS_BLOCK=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")
    
    echo "   HTTPS server блок (строки $SERVER_START-$SERVER_END):"
    echo "$HTTPS_BLOCK" | head -30 | sed 's/^/      /'
    echo ""
    
    # Проверяем proxy_pass директивы
    echo "   Проверка proxy_pass директив:"
    if echo "$HTTPS_BLOCK" | grep -q "proxy_pass.*127.0.0.1:3000"; then
        echo "      ✅ Backend proxy_pass найден"
        BACKEND_PROXY=$(echo "$HTTPS_BLOCK" | grep "proxy_pass.*3000" | head -1)
        echo "         $BACKEND_PROXY" | sed 's/^/         /'
    else
        echo "      ❌ Backend proxy_pass НЕ найден или неправильный!"
    fi
    
    if echo "$HTTPS_BLOCK" | grep -q "proxy_pass.*127.0.0.1:5173"; then
        echo "      ✅ Frontend proxy_pass найден"
        FRONTEND_PROXY=$(echo "$HTTPS_BLOCK" | grep "proxy_pass.*5173" | head -1)
        echo "         $FRONTEND_PROXY" | sed 's/^/         /'
    else
        echo "      ❌ Frontend proxy_pass НЕ найден или неправильный!"
    fi
    echo ""
fi

# 5. Проверка, может ли nginx подключиться к контейнерам
echo "5️⃣ Проверка подключения nginx к контейнерам..."
echo "   Тест проксирования через nginx (HTTP):"
HTTP_PROXY_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://${DOMAIN}/health 2>&1)
if [ "$HTTP_PROXY_TEST" = "200" ]; then
    echo "      ✅ HTTP проксирование работает"
else
    echo "      ⚠️ HTTP проксирование вернуло код: $HTTP_PROXY_TEST"
fi

echo "   Тест проксирования через nginx (HTTPS с -k):"
HTTPS_PROXY_TEST=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health 2>&1)
if [ "$HTTPS_PROXY_TEST" = "200" ]; then
    echo "      ✅ HTTPS проксирование работает"
elif [ "$HTTPS_PROXY_TEST" = "502" ]; then
    echo "      ❌ HTTPS проксирование не работает (502)"
    echo "      Это значит nginx не может подключиться к backend из HTTPS контекста"
else
    echo "      ⚠️ HTTPS проксирование вернуло код: $HTTPS_PROXY_TEST"
fi
echo ""

# 6. Сравнение HTTP и HTTPS блоков
echo "6️⃣ Сравнение HTTP и HTTPS блоков..."
HTTP_BLOCK_START=$(grep -n "listen.*80" "$CONFIG_FILE" | head -1 | cut -d: -f1)
if [ -n "$HTTP_BLOCK_START" ] && [ -n "$HTTPS_BLOCK_START" ]; then
    # Находим HTTP server блок
    HTTP_SERVER_START=$HTTP_BLOCK_START
    while [ "$HTTP_SERVER_START" -gt 0 ]; do
        if grep -q "^[[:space:]]*server {" <(sed -n "${HTTP_SERVER_START}p" "$CONFIG_FILE" 2>/dev/null); then
            break
        fi
        HTTP_SERVER_START=$((HTTP_SERVER_START - 1))
    done
    
    HTTP_SERVER_END=$HTTP_SERVER_START
    HTTP_INDENT=$(sed -n "${HTTP_SERVER_START}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
    HTTP_INDENT=$((HTTP_INDENT - 1))
    
    for i in $(seq $((HTTP_SERVER_START + 1)) $TOTAL_LINES); do
        line=$(sed -n "${i}p" "$CONFIG_FILE")
        line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
        line_indent=$((line_indent - 1))
        
        if [ "$line_indent" -le "$HTTP_INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
            HTTP_SERVER_END=$i
            break
        fi
    done
    
    HTTP_BLOCK=$(sed -n "${HTTP_SERVER_START},${HTTP_SERVER_END}p" "$CONFIG_FILE")
    
    HTTP_LOCATIONS=$(echo "$HTTP_BLOCK" | grep -c "location ")
    HTTPS_LOCATIONS=$(echo "$HTTPS_BLOCK" | grep -c "location ")
    
    echo "   HTTP блок: $HTTP_LOCATIONS location блоков"
    echo "   HTTPS блок: $HTTPS_LOCATIONS location блоков"
    
    if [ "$HTTP_LOCATIONS" -ne "$HTTPS_LOCATIONS" ]; then
        echo "   ⚠️ Количество location блоков отличается!"
        echo "   Это может быть проблемой"
    fi
    echo ""
fi

# Итоговые рекомендации
echo "=========================================="
echo "📋 Выводы и рекомендации:"
echo ""

if [ "$HTTPS_RESPONSE" = "502" ]; then
    echo "❌ ПРОБЛЕМА: HTTPS возвращает 502 Bad Gateway"
    echo ""
    echo "Возможные причины:"
    echo "   1. В HTTPS блоке location блоки настроены неправильно"
    echo "   2. proxy_pass указывает на неправильный адрес"
    echo "   3. Nginx не может подключиться к контейнерам из HTTPS контекста"
    echo ""
    echo "Решение:"
    echo "   1. Проверьте логи: tail -f /var/log/nginx/error.log"
    echo "   2. Убедитесь, что в HTTPS блоке proxy_pass указывает на 127.0.0.1:3000 и 127.0.0.1:5173"
    echo "   3. Сравните HTTP и HTTPS блоки - они должны быть идентичны по location блокам"
    echo ""
    echo "Быстрое исправление:"
    echo "   Скопируйте location блоки из HTTP блока в HTTPS блок"
fi

echo ""
echo "✅ Диагностика завершена!"

