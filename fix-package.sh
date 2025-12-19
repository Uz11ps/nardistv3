#!/bin/bash

echo "🔧 Исправление package.json на сервере..."

cd /var/www/nardiphp

# Исправляем версию @twa-dev/sdk в frontend/package.json
sed -i 's/"@twa-dev\/sdk": "\^1.0.0"/"@twa-dev\/sdk": "^1.0.2"/' frontend/package.json

echo "✅ package.json исправлен"
echo "Теперь запустите: docker-compose build --no-cache && docker-compose up -d"

