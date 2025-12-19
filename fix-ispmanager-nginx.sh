#!/bin/bash

# Скрипт для исправления конфигурации Nginx через ISPmanager

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"

echo "🔧 Исправление конфигурации Nginx для ISPmanager..."

ssh $SERVER << ENDSSH
echo "📝 Проверка конфигураций ISPmanager:"
ls -la /etc/nginx/vhosts-resources/nardist.site/ 2>/dev/null || echo "Директория не найдена"

echo ""
echo "📝 Проверка основной конфигурации ISPmanager:"
grep -r "nardist.site" /etc/nginx/vhosts/ 2>/dev/null | head -5

echo ""
echo "🔧 Решение 1: Добавить кастомную конфигурацию в ISPmanager"

# Создаем директорию если её нет
mkdir -p /etc/nginx/vhosts-resources/nardist.site/

# Создаем кастомную конфигурацию для проксирования
cat > /etc/nginx/vhosts-resources/nardist.site/proxy.conf << 'EOF'
# Кастомная конфигурация для проксирования на Docker контейнеры
# Создано автоматически

# Переопределяем root и index для проксирования
root /dev/null;

# Проксирование на frontend
location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_redirect off;
    
    # Таймауты
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# Проксирование на backend API
location /api {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_redirect off;
    
    # Таймауты
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# WebSocket для Socket.IO
location /socket.io {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Увеличенные таймауты для WebSocket
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}

# Health check
location /health {
    proxy_pass http://127.0.0.1:3000/health;
    access_log off;
}
EOF

echo "✅ Кастомная конфигурация создана"

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

echo ""
echo "📝 Если это не помогло, нужно изменить конфигурацию через ISPmanager:"
echo "1. Войдите в ISPmanager: https://91.229.9.80:1500"
echo "2. WWW → nardist.site → Настройки"
echo "3. В разделе 'Дополнительные директивы nginx' добавьте конфигурацию проксирования"
echo "4. Или измените 'Корневая директория' на пустую и добавьте location блоки"
ENDSSH

