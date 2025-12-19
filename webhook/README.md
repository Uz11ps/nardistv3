# GitHub Webhook для автоматического деплоя

Этот сервер слушает webhook от GitHub и автоматически запускает деплой при push в ветку `main`.

## Быстрый старт

1. Установите зависимости:
   ```bash
   npm install
   ```

2. Настройте переменные окружения:
   ```bash
   export WEBHOOK_SECRET="your-secret-key-change-this"
   export DEPLOY_PATH="/var/www/nardistv3"
   export WEBHOOK_PORT=9000
   ```

3. Запустите сервер:
   ```bash
   node server.js
   ```

## Настройка через systemd

См. подробную инструкцию в `DEPLOY_GITHUB.md`

## Настройка GitHub Webhook

1. В GitHub репозитории: `Settings` → `Webhooks` → `Add webhook`
2. URL: `http://your-server:9000/deploy`
3. Secret: тот же что в `WEBHOOK_SECRET`
4. Events: `Just the push event`

## Логи

- Логи webhook сервера: через systemd или консоль
- Логи деплоя: `/var/log/nardist-deploy.log`

