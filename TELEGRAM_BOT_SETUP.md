# Настройка Telegram бота

## Проблема: "BOT_INVALID"

Если вы видите ошибку "BOT_INVALID", это означает что домен не привязан к боту или не настроены переменные окружения.

## Пошаговая инструкция

### 1. Получить токен бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot` или выберите существующего бота через `/mybots`
3. Следуйте инструкциям для создания/выбора бота
4. Скопируйте **токен бота** (выглядит как `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Привязать домен к боту

1. В @BotFather отправьте `/mybots`
2. Выберите вашего бота
3. Выберите **"Bot Settings"** → **"Domain"**
4. Введите домен: `nardist.site`
5. Скопируйте **Secret Key** (секретный ключ)

### 3. Настроить переменные окружения на сервере

Выполните на сервере:

```bash
cd /var/www/nardiphp
git pull origin main
chmod +x setup-telegram-bot.sh
./setup-telegram-bot.sh
```

Или вручную:

```bash
cd /var/www/nardiphp
nano .env
```

Добавьте/обновите следующие строки:

```env
TELEGRAM_BOT_TOKEN=ваш_токен_бота
TELEGRAM_SECRET_KEY=ваш_секретный_ключ
DOMAIN=nardist.site
```

### 4. Перезапустить backend

```bash
docker-compose restart backend
```

### 5. Проверить логи

```bash
docker-compose logs -f backend
```

Должны увидеть что backend запустился без ошибок.

### 6. Проверить работу

1. Откройте вашего бота в Telegram
2. Нажмите кнопку "Открыть" или отправьте `/start`
3. Приложение должно открыться без ошибки "BOT_INVALID"

## Проверка настроек

### Проверить что домен привязан:

1. Откройте @BotFather
2. `/mybots` → выберите бота → "Bot Settings" → "Domain"
3. Должен быть указан: `nardist.site`

### Проверить переменные окружения:

```bash
cd /var/www/nardiphp
docker-compose exec backend env | grep TELEGRAM
```

Должны увидеть:
- `TELEGRAM_BOT_TOKEN=...`
- `TELEGRAM_SECRET_KEY=...`

## Устранение проблем

### Ошибка "TELEGRAM_SECRET_KEY не настроен"

- Проверьте что файл `.env` существует
- Проверьте что переменная `TELEGRAM_SECRET_KEY` заполнена
- Перезапустите backend: `docker-compose restart backend`

### Ошибка "Неверная подпись Telegram initData"

- Убедитесь что домен `nardist.site` привязан к боту через @BotFather
- Убедитесь что `TELEGRAM_SECRET_KEY` совпадает с ключом из @BotFather
- Проверьте что вы открываете приложение через Telegram бота, а не напрямую в браузере

### Ошибка "Данные авторизации устарели"

- Обновите страницу в Telegram
- Закройте и откройте приложение заново

## Дополнительная информация

- Telegram Mini Apps работают только через Telegram бота
- Домен должен быть привязан через @BotFather
- Secret Key генерируется автоматически при привязке домена
- Backend проверяет подпись initData для безопасности

