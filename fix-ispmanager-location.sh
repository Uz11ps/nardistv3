#!/bin/bash

# Исправление конфликта location / в ISPmanager конфигурации

SERVER="root@91.229.9.80"

echo "🔧 Исправление конфликта location в ISPmanager..."

ssh $SERVER << ENDSSH
echo "📝 Проверка основной конфигурации ISPmanager:"
grep -A 5 "location /" /etc/nginx/vhosts/www-root/nardist.site.conf | head -10

echo ""
echo "🔧 Решение: Изменить основную конфигурацию ISPmanager"

# Создаем бэкап
cp /etc/nginx/vhosts/www-root/nardist.site.conf /etc/nginx/vhosts/www-root/nardist.site.conf.backup

echo "✅ Бэкап создан"

# Проверяем содержимое конфигурации
echo ""
echo "📝 Текущая конфигурация location /:"
grep -A 10 "location /" /etc/nginx/vhosts/www-root/nardist.site.conf

echo ""
echo "🔧 Заменяем location / на проксирование..."

# Используем sed для замены location / на проксирование
# Но лучше использовать более безопасный подход - закомментировать старый и добавить новый

# Сначала удаляем кастомную конфигурацию которая вызывает конфликт
rm -f /etc/nginx/vhosts-resources/nardist.site/proxy.conf

echo ""
echo "📝 Создаем правильную конфигурацию с приоритетом..."

# Создаем конфигурацию которая будет загружаться ПОСЛЕ основной
# Используем более специфичные location блоки
cat > /etc/nginx/vhosts-resources/nardist.site/proxy.conf << 'EOF'
# Кастомная конфигурация для проксирования на Docker контейнеры
# Используем более специфичные location блоки чтобы избежать конфликта

# Переопределяем location / для проксирования
location = / {
    proxy_pass http://127.0.0.1:5173/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_redirect off;
}

# Проксирование всех остальных запросов на frontend
location ~ ^/(?!api|socket\.io|health) {
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
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

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
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

location /socket.io {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}

location /health {
    proxy_pass http://127.0.0.1:3000/health;
    access_log off;
}
EOF

echo "✅ Конфигурация создана"

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
    curl -s http://nardist.site | head -15
    echo ""
    curl -s http://nardist.site/api/health
else
    echo "❌ Ошибка в конфигурации!"
    nginx -t
    echo ""
    echo "💡 Альтернативное решение:"
    echo "Нужно изменить основную конфигурацию ISPmanager через панель управления"
    echo "или напрямую отредактировать /etc/nginx/vhosts/www-root/nardist.site.conf"
fi
ENDSSH

