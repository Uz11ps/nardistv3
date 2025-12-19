#!/bin/bash

# Скрипт для проверки и исправления конфигурации Nginx

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"

echo "🔍 Проверка конфигурации Nginx..."

ssh $SERVER << ENDSSH
echo "📝 Проверка всех конфигураций Nginx:"
echo ""
echo "1. Конфигурация nardist.conf:"
cat /etc/nginx/conf.d/nardist.conf

echo ""
echo "2. Проверка default конфигурации (может перехватывать запросы):"
ls -la /etc/nginx/sites-enabled/
ls -la /etc/nginx/sites-available/

echo ""
echo "3. Проверка include директив в nginx.conf:"
grep -E "include|sites-enabled|conf.d" /etc/nginx/nginx.conf | head -10

echo ""
echo "4. Проверка какой server блок обрабатывает запросы:"
nginx -T 2>/dev/null | grep -A 20 "server_name.*nardist" || echo "Конфигурация для nardist не найдена"

echo ""
echo "🔧 Решение: Отключить default конфигурацию и убедиться что nardist.conf загружается"

# Проверяем default конфигурацию
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "⚠️ Найдена default конфигурация, отключаем..."
    rm -f /etc/nginx/sites-enabled/default
    echo "✅ Default конфигурация отключена"
fi

# Проверяем что nardist.conf существует и правильный
if [ ! -f /etc/nginx/conf.d/nardist.conf ]; then
    echo "❌ Конфигурация nardist.conf не найдена!"
    exit 1
fi

# Проверяем синтаксис
echo "🔍 Проверка синтаксиса..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Синтаксис корректен"
    
    # Перезагружаем Nginx
    echo "🔄 Перезагрузка Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "⏳ Ожидание 3 секунды..."
    sleep 3
    
    echo ""
    echo "✅ Проверка после исправления:"
    echo "Frontend через домен:"
    curl -s http://nardist.site | head -15
    
    echo ""
    echo "Backend API через домен:"
    curl -s http://nardist.site/api/health
    
    echo ""
    echo "Проверка заголовков:"
    curl -s -I http://nardist.site | head -5
else
    echo "❌ Ошибка в конфигурации!"
    nginx -t
fi
ENDSSH

