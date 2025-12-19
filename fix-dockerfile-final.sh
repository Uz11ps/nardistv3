#!/bin/bash

echo "🔧 Финальное исправление Dockerfile..."

cd /var/www/nardiphp

# Проверяем что dist создается при сборке
cat > backend/Dockerfile << 'EOF'
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build && ls -la dist/

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "dist/main"]
EOF

echo "✅ Dockerfile исправлен"
echo "Пересобираем backend..."
docker-compose build --no-cache backend
docker-compose up -d backend

echo "Проверяем содержимое dist..."
docker-compose exec backend ls -la /app/dist/ || echo "Контейнер еще не запущен"

