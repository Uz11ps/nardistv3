#!/bin/bash

echo "🔒 Настройка SSL сертификата Let's Encrypt..."

DOMAIN="nardist.site"

# Проверка наличия certbot
if ! command -v certbot &> /dev/null; then
    echo "📦 Установка certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Выпуск сертификата
echo "🔐 Выпуск сертификата для $DOMAIN..."
certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Проверка сертификата
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Сертификат успешно выпущен!"
    echo "📁 Путь к сертификату: /etc/letsencrypt/live/$DOMAIN/"
    echo ""
    echo "Настройте в ISPmanager 6:"
    echo "1. Откройте домен $DOMAIN"
    echo "2. SSL → Использовать существующий сертификат"
    echo "3. Укажите путь: /etc/letsencrypt/live/$DOMAIN/"
else
    echo "❌ Ошибка выпуска сертификата"
    exit 1
fi

