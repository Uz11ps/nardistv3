FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-slim

WORKDIR /app

# Установка GNU Backgammon для анализа коротких нард
# Используем Debian-based образ, так как gnubg доступен в его репозиториях
RUN apt-get update && \
    apt-get install -y gnubg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]

