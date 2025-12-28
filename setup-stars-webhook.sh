#!/bin/bash

echo "🔧 Настройка webhook для Telegram Stars"
echo ""

# Проверить наличие .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    exit 1
fi

# Проверить переменные
source .env

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ "$TELEGRAM_BOT_TOKEN" = "your_bot_token_here" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN не настроен!"
    exit 1
fi

if [ -z "$DOMAIN" ]; then
    echo "❌ DOMAIN не настроен!"
    exit 1
fi

WEBHOOK_URL="https://${DOMAIN}/api/payment/webhook"

echo "📋 Настройка webhook для Stars платежей"
echo "URL: ${WEBHOOK_URL}"
echo ""

# Устанавливаем webhook через Telegram Bot API
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\", \"pre_checkout_query\"]}")

echo "Ответ от Telegram API:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Проверяем статус webhook
echo "🔍 Проверка статуса webhook..."
STATUS_RESPONSE=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")
echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"
echo ""

echo "✅ Настройка завершена!"
echo ""
echo "📝 Важно:"
echo "1. Убедитесь, что ваш домен ${DOMAIN} доступен из интернета"
echo "2. Убедитесь, что SSL сертификат настроен (HTTPS обязателен)"
echo "3. Webhook должен быть доступен по адресу: ${WEBHOOK_URL}"
echo "4. Для Stars платежей бот должен быть настроен через @BotFather"
echo ""

