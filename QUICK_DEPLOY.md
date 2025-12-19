# Быстрый деплой - Инструкция

## Самый простой способ (рекомендуется)

### Вариант 1: Через WinSCP (для Windows)

1. **Скачайте WinSCP**: https://winscp.net/eng/download.php

2. **Подключитесь к серверу**:
   - Host: `91.229.9.80`
   - User: `root`
   - Password: `ksOVrfa4yeQEb3cR`
   - Protocol: SFTP

3. **Загрузите файлы**:
   - Перейдите в `/var/www/nardiphp` на сервере
   - Загрузите все файлы проекта (кроме `node_modules`, `.git`, `dist`, `build`)

4. **Подключитесь по SSH** через WinSCP (кнопка "Терминал") или используйте PuTTY:
   ```bash
   ssh root@91.229.9.80
   ```

5. **Выполните на сервере**:
   ```bash
   cd /var/www/nardiphp
   
   # Создайте .env файл
   cat > .env << 'EOF'
   TELEGRAM_BOT_TOKEN=8283196243:AAHScPWoLwr-UtrT71YXf0y8XKim_slIg5w
   TELEGRAM_SECRET_KEY=change_this_after_bot_setup
   POSTGRES_HOST=postgres
   POSTGRES_PORT=5432
   POSTGRES_USER=nardi
   POSTGRES_PASSWORD=NardiSecure2024!Pass
   POSTGRES_DB=nardi_db
   REDIS_HOST=redis
   REDIS_PORT=6379
   JWT_SECRET=NardiJWTSecretKey2024!ChangeThisInProductionMin32Chars
   NODE_ENV=production
   BACKEND_PORT=3000
   FRONTEND_PORT=5173
   DOMAIN=nardist.site
   VITE_API_URL=https://nardist.site/api
   VITE_WS_URL=wss://nardist.site
   VITE_TELEGRAM_BOT_NAME=nardist_bot
   EOF
   
   # Запустите деплой
   bash setup-server.sh
   ```

### Вариант 2: Через PowerShell (если SSH настроен)

Просто выполните:
```powershell
.\deploy-now.ps1
```

Вам нужно будет ввести пароль несколько раз: `ksOVrfa4yeQEb3cR`

### Вариант 3: Ручной деплой через SSH

1. **Подключитесь к серверу**:
   ```bash
   ssh root@91.229.9.80
   # Пароль: ksOVrfa4yeQEb3cR
   ```

2. **Подготовьте директорию**:
   ```bash
   cd /var/www
   mkdir -p nardiphp
   cd nardiphp
   ```

3. **Загрузите файлы** (используйте WinSCP, FileZilla или scp)

4. **Создайте .env** (см. выше)

5. **Запустите деплой**:
   ```bash
   bash setup-server.sh
   ```

## После деплоя

1. **Проверьте работу**:
   - Backend: http://nardist.site:3000/health
   - Frontend: http://nardist.site:5173

2. **Настройте Telegram бота**:
   - Откройте @BotFather
   - `/setdomain` → `nardist.site`
   - Получите секретный ключ и обновите `.env` на сервере

3. **Настройте ISPmanager 6**:
   - Создайте домен `nardist.site`
   - Настройте SSL (Let's Encrypt)
   - Настройте проксирование:
     - Backend: `http://localhost:3000`
     - Frontend: `http://localhost:5173`

## Просмотр логов

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp
docker-compose logs -f backend
docker-compose logs -f frontend
```

