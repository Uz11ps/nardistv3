#!/bin/bash

# Проверка, что реально отдает frontend контейнер

DOMAIN="nardist.site"

echo "🔍 Проверка frontend контейнера..."
echo ""

# 1. Проверяем, что отдает frontend напрямую
echo "1️⃣ Что отдает frontend на localhost:5173..."
FRONTEND_RESPONSE=$(curl -s http://localhost:5173 2>&1 | head -30)
echo "Первые 30 строк ответа:"
echo "$FRONTEND_RESPONSE"
echo ""

if echo "$FRONTEND_RESPONSE" | grep -qi "Website.*ready\|content is to be added\|ispmanager\|приветствуем"; then
    echo "   ❌ Frontend контейнер сам отдает заглушку!"
    echo "   Проблема в frontend контейнере, а не в nginx"
    echo ""
    
    # Проверяем, что внутри контейнера
    echo "2️⃣ Проверка содержимого frontend контейнера..."
    FRONTEND_CONTAINER=$(docker ps | grep "nardi_frontend" | awk '{print $1}')
    
    if [ -n "$FRONTEND_CONTAINER" ]; then
        echo "   Frontend контейнер: $FRONTEND_CONTAINER"
        echo ""
        
        echo "   Проверяю, что слушает контейнер:"
        docker exec $FRONTEND_CONTAINER netstat -tlnp 2>/dev/null || docker exec $FRONTEND_CONTAINER ss -tlnp 2>/dev/null || echo "   Не удалось проверить порты в контейнере"
        echo ""
        
        echo "   Проверяю процессы в контейнере:"
        docker exec $FRONTEND_CONTAINER ps aux 2>/dev/null | head -10
        echo ""
        
        echo "   Проверяю логи контейнера:"
        docker logs --tail=20 $FRONTEND_CONTAINER 2>&1 | tail -10
        echo ""
        
        echo "   Проверяю, что в /usr/share/nginx/html (если это nginx в контейнере):"
        docker exec $FRONTEND_CONTAINER ls -la /usr/share/nginx/html/ 2>/dev/null | head -10 || echo "   Директория не найдена"
        echo ""
        
        echo "   Проверяю, что в /app (если это node/vite):"
        docker exec $FRONTEND_CONTAINER ls -la /app/ 2>/dev/null | head -10 || echo "   Директория не найдена"
        echo ""
        
        echo "   Проверяю конфигурацию nginx в контейнере (если есть):"
        docker exec $FRONTEND_CONTAINER cat /etc/nginx/conf.d/default.conf 2>/dev/null || docker exec $FRONTEND_CONTAINER cat /etc/nginx/nginx.conf 2>/dev/null | head -30 || echo "   Nginx конфиг не найден"
    fi
else
    echo "   ✅ Frontend отдает правильный контент (не заглушку)"
    echo "   Значит проблема в nginx или в чем-то еще"
    echo ""
    
    # Проверяем, что nginx реально проксирует
    echo "2️⃣ Проверка, что nginx проксирует на frontend..."
    NGINX_RESPONSE=$(curl -k -s -H "Host: ${DOMAIN}" https://127.0.0.1/ 2>&1 | head -30)
    echo "Ответ через nginx:"
    echo "$NGINX_RESPONSE" | head -10
    echo ""
    
    if echo "$NGINX_RESPONSE" | grep -qi "Website.*ready"; then
        echo "   ❌ Через nginx все еще заглушка!"
        echo "   Значит nginx не проксирует правильно"
    else
        echo "   ✅ Через nginx правильный контент"
        echo "   Значит проблема в кэше браузера или DNS"
    fi
fi

echo ""
echo "=========================================="
echo "📋 Рекомендации:"
echo ""

if echo "$FRONTEND_RESPONSE" | grep -qi "Website.*ready"; then
    echo "❌ ПРОБЛЕМА: Frontend контейнер отдает заглушку"
    echo ""
    echo "Решения:"
    echo "   1. Проверьте, что frontend контейнер правильно собран"
    echo "   2. Проверьте, что в контейнере правильные файлы"
    echo "   3. Пересоберите frontend:"
    echo "      cd /var/www/nardiphp"
    echo "      docker-compose build frontend"
    echo "      docker-compose up -d frontend"
    echo ""
    echo "   4. Проверьте Dockerfile frontend - возможно он копирует заглушку"
    echo "   5. Проверьте, что frontend правильно собирается (npm run build)"
else
    echo "✅ Frontend контейнер работает правильно"
    echo "   Проблема может быть в:"
    echo "   1. Кэше браузера - очистите кэш (Ctrl+Shift+Delete)"
    echo "   2. DNS кэше - подождите несколько минут"
    echo "   3. CDN или прокси перед сервером"
    echo "   4. Другой сервис на том же IP"
fi

echo ""
echo "✅ Проверка завершена!"

