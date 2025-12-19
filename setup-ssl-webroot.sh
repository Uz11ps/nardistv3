#!/bin/bash

echo "🔒 Выпуск SSL сертификата Let's Encrypt через webroot метод..."

DOMAIN="nardist.site"
WEBROOT="/var/www/nardist.site"

# Создаем директорию для webroot если не существует
mkdir -p "$WEBROOT/.well-known/acme-challenge"

# Выпуск сертификата через webroot (не требует остановки веб-сервера)
certbot certonly --webroot \
  -w "$WEBROOT" \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email admin@$DOMAIN

# Проверка сертификата
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Сертификат успешно выпущен!"
    echo "📁 Путь: /etc/letsencrypt/live/$DOMAIN/"
    echo ""
    echo "Теперь настройте в ISPmanager 6:"
    echo "1. Откройте домен $DOMAIN"
    echo "2. SSL → Использовать существующий сертификат"
    echo "3. Укажите путь: /etc/letsencrypt/live/$DOMAIN/"
else
    echo "❌ Ошибка выпуска сертификата"
    exit 1
fi

