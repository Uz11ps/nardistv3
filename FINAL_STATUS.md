# Статус деплоя

## ✅ Успешно развернуто

Все сервисы работают:
- ✅ Backend: http://nardist.site:3000 (работает)
- ✅ Frontend: http://nardist.site:5173 (работает)
- ✅ PostgreSQL: работает
- ✅ Redis: работает

## Проверка работы

```bash
# Health check
curl http://localhost:3000/health
# Ответ: {"status":"ok","timestamp":"..."}

# Статус контейнеров
docker-compose ps
# Все контейнеры должны быть в статусе "Up"
```

## Настройка ISPmanager 6

1. **Создайте домен** `nardist.site` в ISPmanager
2. **Настройте SSL** через Let's Encrypt
3. **Настройте проксирование**:
   - Backend: `http://localhost:3000`
   - Frontend: `http://localhost:5173`
   - WebSocket: `ws://localhost:3000` (для WebSocket используйте `wss://` при HTTPS)

## Настройка Telegram бота

1. Откройте @BotFather в Telegram
2. Отправьте `/setdomain`
3. Укажите: `nardist.site`
4. Получите секретный ключ
5. Обновите `.env` на сервере:
   ```bash
   nano /var/www/nardiphp/.env
   # Обновите TELEGRAM_SECRET_KEY
   docker-compose restart backend
   ```

## База данных

База данных автоматически синхронизируется при запуске (synchronize: true).
Таблицы создаются автоматически при первом запуске.

## Доступные эндпоинты

- `GET /health` - проверка здоровья
- `POST /auth/login` - авторизация через Telegram
- `GET /auth/me` - текущий пользователь
- `GET /games/:id` - получить игру
- `GET /ratings/leaderboard` - таблица лидеров
- `GET /tournaments` - список турниров
- `GET /city` - город пользователя
- `GET /quests` - задания
- `GET /history` - история игр
- `GET /academy` - статьи обучения
- `GET /skins` - скины

## WebSocket эндпоинты

- `/games` - игровые события
- `/matchmaking` - матчмейкинг

## Следующие шаги

1. Настройте домен в ISPmanager 6
2. Настройте SSL сертификат
3. Настройте Telegram бота
4. Протестируйте приложение через Telegram Mini App

Проект готов к использованию! 🎉

