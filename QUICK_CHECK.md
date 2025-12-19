# Быстрая проверка деплоя

## ✅ Backend успешно собран!

Теперь проверьте работу:

### 1. Статус контейнеров

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp
docker-compose ps
```

Все контейнеры должны быть в статусе `Up` или `Healthy`.

### 2. Логи backend

```bash
docker-compose logs --tail=50 backend
```

Ищите:
- ✅ `Nest application successfully started`
- ✅ `Application is running on: http://[::]:3000`
- ❌ Ошибки подключения к БД или Redis

### 3. Логи frontend

```bash
docker-compose logs --tail=50 frontend
```

Должны быть только сообщения Nginx о запуске.

### 4. Проверка API

```bash
# Health check
curl http://localhost:3000/health

# Или через домен (если настроен прокси)
curl https://nardist.site/api/health
```

### 5. Проверка frontend

Откройте в браузере:
- https://nardist.site

### 6. Если что-то не работает

**Backend не запускается:**
```bash
docker-compose logs backend | grep -i error
docker-compose exec backend ls -la /app/dist/
```

**Frontend не работает:**
```bash
docker-compose logs frontend
docker-compose exec frontend ls -la /usr/share/nginx/html/
```

**База данных:**
```bash
docker-compose exec postgres psql -U nardi -d nardi_db -c "\dt"
```

## Следующие шаги

1. ✅ Проверьте работу приложения в браузере
2. ✅ Протестируйте основные функции:
   - Авторизацию через Telegram
   - Онбординг
   - Главное меню
   - Поиск игры
   - Игровую доску
   - Кланы (если уровень >= 20)
   - Историю игр

3. ✅ Настройте Telegram бота:
   - Откройте @BotFather
   - `/setdomain` → `nardist.site`
   - Получите секретный ключ
   - Обновите `TELEGRAM_SECRET_KEY` в `.env`
   - Перезапустите: `docker-compose restart backend`

## Готово! 🎉

Приложение должно быть полностью функциональным!

