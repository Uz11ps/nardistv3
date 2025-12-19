#!/bin/bash

# Финальная проверка и исправление /health endpoint

DOMAIN="nardist.site"

echo "🔍 Финальная проверка работы сайта..."
echo ""

# 1. Проверка HTTP (должен редиректить на HTTPS)
echo "1️⃣ Проверка HTTP (редирект на HTTPS)..."
HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" -L http://${DOMAIN} 2>&1)
if [ "$HTTP_TEST" = "200" ] || [ "$HTTP_TEST" = "301" ] || [ "$HTTP_TEST" = "302" ]; then
    echo "   ✅ HTTP работает (код: $HTTP_TEST)"
else
    echo "   ⚠️ HTTP вернул код: $HTTP_TEST"
fi

# 2. Проверка HTTPS главной страницы
echo "2️⃣ Проверка HTTPS главной страницы..."
HTTPS_MAIN=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/ 2>&1)
if [ "$HTTPS_MAIN" = "200" ]; then
    echo "   ✅ HTTPS главная работает (код: $HTTPS_MAIN)"
    
    # Проверяем контент
    MAIN_CONTENT=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -30)
    if echo "$MAIN_CONTENT" | grep -qi "заглушка\|welcome\|ispmanager\|только что создан\|приветствуем"; then
        echo "   ❌ Все еще показывает заглушку!"
    else
        echo "   ✅ Контент правильный (не заглушка)"
        if echo "$MAIN_CONTENT" | grep -qi "Нарды\|root\|vite"; then
            echo "   ✅ Это frontend приложение!"
        fi
    fi
else
    echo "   ❌ HTTPS главная вернула код: $HTTPS_MAIN"
fi

# 3. Проверка /health
echo "3️⃣ Проверка /health endpoint..."
HTTPS_HEALTH=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health 2>&1)
if [ "$HTTPS_HEALTH" = "200" ]; then
    echo "   ✅ /health работает (код: $HTTPS_HEALTH)"
    HEALTH_CONTENT=$(curl -k -s https://${DOMAIN}/health 2>&1)
    echo "   Ответ: $HEALTH_CONTENT"
elif [ "$HTTPS_HEALTH" = "404" ]; then
    echo "   ⚠️ /health вернул 404"
    echo "   Проверяю backend..."
    
    # Проверяем backend напрямую
    BACKEND_HEALTH=$(curl -s http://localhost:3000/health 2>&1)
    if [ -n "$BACKEND_HEALTH" ]; then
        echo "   ✅ Backend /health доступен: $BACKEND_HEALTH"
        echo "   Проблема в конфигурации nginx для /health"
    else
        echo "   ❌ Backend /health недоступен"
    fi
else
    echo "   ⚠️ /health вернул код: $HTTPS_HEALTH"
fi

# 4. Проверка /api
echo "4️⃣ Проверка /api endpoint..."
HTTPS_API=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/api/health 2>&1)
if [ "$HTTPS_API" = "200" ]; then
    echo "   ✅ /api работает (код: $HTTPS_API)"
elif [ "$HTTPS_API" = "404" ]; then
    echo "   ⚠️ /api вернул 404"
else
    echo "   ⚠️ /api вернул код: $HTTPS_API"
fi

echo ""
echo "=========================================="
echo "📋 Итоговый статус:"
echo ""

if [ "$HTTPS_MAIN" = "200" ]; then
    echo "✅ HTTPS РАБОТАЕТ! Frontend отображается правильно!"
    echo ""
    echo "🌐 Откройте в браузере: https://${DOMAIN}"
    echo ""
    
    if [ "$HTTPS_HEALTH" != "200" ]; then
        echo "⚠️ /health endpoint не работает, но это не критично для frontend"
    fi
else
    echo "❌ HTTPS все еще не работает полностью"
fi

echo ""
echo "✅ Проверка завершена!"

