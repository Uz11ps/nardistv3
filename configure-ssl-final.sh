#!/bin/bash

echo "🔧 Финальная настройка SSL и проксирования..."

DOMAIN="nardist.site"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"

echo "✅ Сертификат выпущен:"
echo "   Fullchain: ${CERT_PATH}/fullchain.pem"
echo "   Privkey: ${CERT_PATH}/privkey.pem"
echo ""

echo "📝 Инструкция для ISPmanager 6:"
echo ""
echo "1. Откройте домен ${DOMAIN} в ISPmanager"
echo "2. Перейдите в раздел 'SSL'"
echo "3. Выберите 'Использовать существующий сертификат'"
echo "4. Укажите путь: ${CERT_PATH}/"
echo "5. Сохраните"
echo ""
echo "6. Настройте проксирование:"
echo "   - Backend API: /api → http://localhost:3000"
echo "   - WebSocket: /socket.io, /games, /matchmaking → ws://localhost:3000"
echo "   - Frontend: / → http://localhost:5173"
echo ""

echo "🔍 Проверка сертификата:"
openssl x509 -in ${CERT_PATH}/fullchain.pem -noout -subject -dates

echo ""
echo "✅ После настройки в ISPmanager проверьте:"
echo "   curl -I https://${DOMAIN}"
echo "   curl https://${DOMAIN}/health"

