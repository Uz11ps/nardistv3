#!/bin/bash

echo "🔧 Исправление Dockerfile файлов..."

cd /var/www/nardiphp

# Исправляем backend Dockerfile
cat > backend/Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

RUN npm install -g @nestjs/cli

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
EOF

# Исправляем frontend Dockerfile
cat > frontend/Dockerfile << 'EOF'
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
EOF

# Убираем version из docker-compose.yml
sed -i '/^version:/d' docker-compose.yml

echo "✅ Dockerfile файлы исправлены"
echo "Теперь запустите: docker-compose build --no-cache && docker-compose up -d"

