#!/bin/bash

# Скрипт для исправления конфликта Nginx и Apache

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"

echo "🔧 Исправление конфликта Nginx и Apache..."

ssh $SERVER << ENDSSH
echo "📊 Проверка запущенных веб-серверов:"
systemctl status nginx --no-pager | head -5
echo ""
systemctl status apache2 --no-pager | head -5 2>/dev/null || echo "Apache не установлен или не запущен"

echo ""
echo "🔍 Проверка портов:"
netstat -tlnp | grep -E ':80|:443' || ss -tlnp | grep -E ':80|:443'

echo ""
echo "📝 Проверка конфигурации Nginx:"
ls -la /etc/nginx/conf.d/nardist.conf
cat /etc/nginx/conf.d/nardist.conf | head -20

echo ""
echo "🔧 Решение 1: Отключить Apache (если он мешает)"
echo "Если Apache запущен на порту 80, нужно его остановить:"
echo "systemctl stop apache2"
echo "systemctl disable apache2"

echo ""
echo "🔧 Решение 2: Настроить Nginx на другой порт и проксировать через Apache"
echo "Или настроить Apache для проксирования на Docker контейнеры"

echo ""
echo "🔧 Решение 3: Использовать только Nginx (рекомендуется)"
echo "Остановим Apache и убедимся что Nginx слушает порт 80:"

# Проверяем что Nginx слушает порт 80
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx запущен"
    
    # Проверяем конфигурацию
    if nginx -t 2>&1 | grep -q "successful"; then
        echo "✅ Конфигурация Nginx корректна"
        
        # Проверяем что Nginx слушает порт 80
        if ss -tlnp | grep -q "nginx.*:80"; then
            echo "✅ Nginx слушает порт 80"
        else
            echo "⚠️ Nginx не слушает порт 80"
        fi
        
        # Если Apache запущен, останавливаем его
        if systemctl is-active --quiet apache2 2>/dev/null; then
            echo "⚠️ Apache запущен, останавливаем..."
            systemctl stop apache2
            systemctl disable apache2
            echo "✅ Apache остановлен"
        fi
        
        # Перезагружаем Nginx
        echo "🔄 Перезагрузка Nginx..."
        systemctl reload nginx
        
        echo ""
        echo "✅ Проверка после исправления:"
        sleep 2
        curl -s http://localhost:5173 | head -5
        echo ""
        curl -s http://localhost:3000/health
    else
        echo "❌ Ошибка в конфигурации Nginx!"
        nginx -t
    fi
else
    echo "❌ Nginx не запущен!"
    systemctl start nginx
fi

echo ""
echo "📊 Финальная проверка портов:"
ss -tlnp | grep -E ':80|:443|:3000|:5173'

echo ""
echo "🌐 Проверка доступности через домен:"
curl -s http://nardist.site | head -10
echo ""
curl -s http://nardist.site/api/health || echo "API недоступен"
ENDSSH

