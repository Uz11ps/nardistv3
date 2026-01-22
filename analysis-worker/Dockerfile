FROM node:20-slim

WORKDIR /app

# Установка GNU Backgammon для анализа коротких нард
RUN apt-get update && \
    apt-get install -y gnubg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install --only=production

# Копируем собранный код
COPY dist ./dist

# Переменные окружения
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main"]

