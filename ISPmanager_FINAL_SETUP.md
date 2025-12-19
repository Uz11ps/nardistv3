# Финальная настройка в ISPmanager 6

## ✅ SSL сертификат выпущен

Сертификат Let's Encrypt успешно выпущен:
- Путь: `/etc/letsencrypt/live/nardist.site/`
- Действителен до: 2026-03-19
- Автоматическое обновление настроено

## Настройка в ISPmanager 6

### Шаг 1: Настройка SSL сертификата

1. Войдите в ISPmanager 6
2. Откройте раздел **"WWW"**
3. Найдите домен **`nardist.site`** и откройте его
4. Перейдите в раздел **"SSL"**
5. Выберите **"Использовать существующий сертификат"**
6. Укажите путь: `/etc/letsencrypt/live/nardist.site/`
7. Нажмите **"Сохранить"**

### Шаг 2: Настройка проксирования

В настройках домена `nardist.site`:

1. Перейдите в **"Настройки"** → **"Дополнительные настройки Nginx"**
2. Добавьте следующую конфигурацию:

```nginx
# Проксирование Backend API
location /api {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# Проксирование WebSocket для игр
location /socket.io {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /games {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /matchmaking {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Проксирование Frontend
location / {
    proxy_pass http://localhost:5173;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

3. Сохраните изменения
4. Перезагрузите Nginx (обычно делается автоматически)

### Шаг 3: Обновление переменных окружения

Выполните на сервере:

```bash
cd /var/www/nardiphp

# Обновляем .env для HTTPS
sed -i 's|VITE_API_URL=http://nardist.site|VITE_API_URL=https://nardist.site|' .env
sed -i 's|VITE_WS_URL=ws://nardist.site|VITE_WS_URL=wss://nardist.site|' .env

# Перезапускаем frontend
docker-compose restart frontend
```

## Проверка работы

После настройки проверьте:

```bash
# Проверка HTTPS
curl -I https://nardist.site

# Проверка Backend API
curl https://nardist.site/api/health

# Проверка Frontend
curl -I https://nardist.site
```

## Настройка Telegram бота

1. Откройте @BotFather в Telegram
2. Отправьте `/setdomain`
3. Укажите домен: `nardist.site`
4. Получите секретный ключ
5. Обновите `.env` на сервере:
   ```bash
   nano /var/www/nardiphp/.env
   # Обновите TELEGRAM_SECRET_KEY
   docker-compose restart backend
   ```

## Готово! 🎉

После выполнения всех шагов ваше приложение будет доступно по адресу:
- **Frontend**: https://nardist.site
- **Backend API**: https://nardist.site/api
- **WebSocket**: wss://nardist.site

