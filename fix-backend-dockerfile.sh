#!/bin/bash

echo "🔧 Исправление backend Dockerfile..."

cd /var/www/nardiphp

cat > backend/Dockerfile << 'EOF'
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN npm install -g @nestjs/cli

EXPOSE 3000

CMD ["node", "dist/main"]
EOF

echo "✅ Dockerfile исправлен"
echo "Пересобираем backend..."
docker-compose build --no-cache backend
docker-compose up -d backend

