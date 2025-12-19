#!/bin/bash

# Скрипт для исправления HTTPS и остановки Apache

echo "🔧 Исправление HTTPS и остановка Apache..."
echo ""

# Останавливаем Apache
echo "1. Остановка Apache..."
systemctl stop apache2
systemctl disable apache2

# Проверяем что Apache остановлен
if systemctl is-active --quiet apache2; then
    echo "⚠️ Apache всё ещё запущен, принудительно останавливаем..."
    pkill -9 apache2
fi

echo "✅ Apache остановлен"

# Проверяем что Nginx работает
echo ""
echo "2. Проверка Nginx..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx работает"
else
    echo "❌ Nginx не работает, запускаем..."
    systemctl start nginx
    systemctl enable nginx
fi

# Запускаем скрипт для добавления location блоков в HTTPS
echo ""
echo "3. Добавление location блоков в HTTPS конфигурацию..."
cd /var/www/nardiphp
chmod +x fix-https-locations.sh
./fix-https-locations.sh

echo ""
echo "4. Проверка работы:"
echo "HTTPS frontend:"
curl -k -s https://nardist.site | head -10
echo ""
echo "HTTPS API:"
curl -k -s https://nardist.site/api/health
echo ""

