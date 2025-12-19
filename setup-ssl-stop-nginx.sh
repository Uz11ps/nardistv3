#!/bin/bash

echo "🔒 Выпуск SSL сертификата Let's Encrypt (с остановкой Nginx)..."

DOMAIN="nardist.site"

# Останавливаем Nginx временно
echo "⏸️  Останавливаем Nginx..."
systemctl stop nginx || service nginx stop

# Выпуск сертификата
echo "🔐 Выпуск сертификата..."
certbot certonly --standalone \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email admin@$DOMAIN

# Запускаем Nginx обратно
echo "▶️  Запускаем Nginx..."
systemctl start nginx || service nginx start

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

