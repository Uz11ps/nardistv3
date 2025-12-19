#!/bin/bash

echo "🔧 Финальное исправление типов..."

cd /var/www/nardiphp

# Исправляем типы в user.entity.ts
sed -i 's/xp: number;/xp: bigint;/' backend/src/users/user.entity.ts
sed -i 's/narCoin: number;/narCoin: bigint;/' backend/src/users/user.entity.ts

echo "✅ Типы исправлены"
echo "Пересобираем backend..."
docker-compose build --no-cache backend
docker-compose up -d backend

