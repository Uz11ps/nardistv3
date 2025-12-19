# Инструкция по деплою на сервер

## Автоматический деплой через GitHub

### Вариант 1: GitHub Actions (Рекомендуется)

Автоматический деплой через GitHub Actions при каждом push в ветку `main`.

#### Настройка:

1. **Настройте GitHub Secrets** в настройках репозитория:
   - `Settings` → `Secrets and variables` → `Actions` → `New repository secret`
   
   Добавьте следующие секреты:
   - `SERVER_HOST` - IP адрес или домен вашего сервера (например: `91.229.9.80`)
   - `SERVER_USER` - пользователь для SSH (например: `root`)
   - `SERVER_SSH_KEY` - приватный SSH ключ для доступа к серверу
   - `SERVER_SSH_PORT` - порт SSH (по умолчанию: `22`)
   - `SERVER_PATH` - путь к проекту на сервере (например: `/var/www/nardistv3`)

2. **Создайте SSH ключ** (если еще нет):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions"
   # Скопируйте приватный ключ в GitHub Secret SERVER_SSH_KEY
   # Добавьте публичный ключ на сервер:
   ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-server
   ```

3. **Готово!** При каждом push в `main` ветку будет запускаться автоматический деплой.

#### Ручной запуск деплоя:
   - В GitHub репозитории: `Actions` → выберите workflow `Deploy to Server` → `Run workflow`

### Вариант 2: GitHub Webhook

Автоматический деплой через webhook при каждом push.

#### Настройка на сервере:

1. **Установите зависимости:**
   ```bash
   cd webhook
   npm install
   ```

2. **Настройте переменные окружения:**
   ```bash
   export WEBHOOK_SECRET="your-secret-key-change-this"
   export DEPLOY_PATH="/var/www/nardistv3"
   export WEBHOOK_PORT=9000
   ```

3. **Сделайте скрипт исполняемым:**
   ```bash
   chmod +x webhook/deploy.sh
   chmod +x webhook/server.js
   ```

4. **Запустите webhook сервер:**
   ```bash
   # Простой запуск
   cd webhook && npm start
   
   # Или через PM2 (рекомендуется)
   npm install -g pm2
   pm2 start webhook/server.js --name webhook-deploy
   pm2 save
   pm2 startup  # Следуйте инструкциям для автозапуска
   ```

5. **Настройте GitHub Webhook:**
   - В GitHub репозитории: `Settings` → `Webhooks` → `Add webhook`
   - **Payload URL**: `http://your-server:9000/deploy`
   - **Content type**: `application/json`
   - **Secret**: тот же `WEBHOOK_SECRET` что настроили на сервере
   - **Events**: выберите `Just the push event`

6. **Откройте порт** (если используется firewall):
   ```bash
   ufw allow 9000/tcp
   ```

## Ручной деплой

### Быстрый деплой (рекомендуется)

```bash
chmod +x deploy-quick.sh
./deploy-quick.sh
```

Этот скрипт:
1. Обновит код из git
2. Пересоберет и перезапустит контейнеры
3. Покажет статус

### Полный деплой (без кэша)

Если нужно полностью пересобрать образы:

```bash
chmod +x deploy.sh
./deploy.sh
```

## Ручной деплой

Если скрипты не работают, выполните команды вручную:

```bash
# 1. Обновить код
git pull origin main

# 2. Остановить контейнеры
docker-compose down

# 3. Пересобрать образы
docker-compose build --no-cache

# 4. Запустить контейнеры
docker-compose up -d

# 5. Проверить статус
docker-compose ps

# 6. Посмотреть логи (если нужно)
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Проверка после деплоя

1. **Проверьте админ-панель:**
   - Откройте https://nardist.site/admin
   - Логин: `123`, Пароль: `123123`

2. **Проверьте API:**
   ```bash
   curl https://nardist.site/api/health
   ```

3. **Проверьте логи на ошибки:**
   ```bash
   docker-compose logs backend | grep -i error
   docker-compose logs frontend | grep -i error
   ```

## Откат изменений

Если что-то пошло не так:

```bash
# Откатить к предыдущему коммиту
git reset --hard HEAD~1

# Пересобрать
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Полезные команды

```bash
# Посмотреть логи всех сервисов
docker-compose logs -f

# Перезапустить конкретный сервис
docker-compose restart backend
docker-compose restart frontend

# Войти в контейнер backend
docker-compose exec backend sh

# Очистить неиспользуемые образы
docker system prune -a
```
