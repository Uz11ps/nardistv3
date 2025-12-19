# Как получить TELEGRAM_SECRET_KEY

## Пошаговая инструкция:

### Шаг 1: Откройте @BotFather в Telegram
Найдите бота `@BotFather` в Telegram и откройте его.

### Шаг 2: Выберите вашего бота
Отправьте команду:
```
/mybots
```

Вы увидите список ваших ботов. Выберите того бота, для которого хотите настроить Mini App.

### Шаг 3: Откройте настройки бота
После выбора бота вы увидите меню:
- Edit Bot
- Delete Bot
- **Bot Settings** ← выберите это
- ...

### Шаг 4: Выберите Domain
В меню Bot Settings выберите:
```
Domain
```

### Шаг 5: Введите домен
Telegram попросит вас ввести домен для Mini App. Введите:
```
nardist.site
```

**ВАЖНО:** Не добавляйте `https://` или `http://`, только домен: `nardist.site`

### Шаг 6: Получите Secret Key
После ввода домена Telegram покажет вам:
- Домен (nardist.site)
- **Secret Key** - это то, что вам нужно!

Secret Key выглядит примерно так:
```
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890abcdefghijklmnopqrstuvwxyz
```

### Шаг 7: Скопируйте Secret Key
Скопируйте весь Secret Key (он может быть длинным, скопируйте полностью).

### Шаг 8: Добавьте в .env файл на сервере
На сервере отредактируйте файл `.env`:
```bash
nano /var/www/nardiphp/.env
```

Добавьте или обновите строку:
```
TELEGRAM_SECRET_KEY=ваш_скопированный_secret_key
```

Например:
```
TELEGRAM_SECRET_KEY=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890abcdefghijklmnopqrstuvwxyz
```

### Шаг 9: Перезапустите backend
После сохранения `.env` файла перезапустите backend контейнер:
```bash
cd /var/www/nardiphp
docker-compose restart backend
```

### Шаг 10: Проверьте работу
Откройте бота в Telegram и нажмите кнопку "Открыть" или "Start". Приложение должно открыться и авторизовать вас.

---

## Альтернативный способ (если Domain уже настроен):

Если домен уже был привязан ранее, но вы не помните Secret Key:

1. Откройте @BotFather
2. `/mybots` → выберите бота
3. Bot Settings → Domain
4. Выберите "Change domain" или "Remove domain"
5. Затем снова добавьте домен `nardist.site`
6. Telegram покажет новый Secret Key

---

## Проверка что все настроено правильно:

Выполните на сервере:
```bash
cd /var/www/nardiphp
chmod +x check-telegram-auth.sh
./check-telegram-auth.sh
```

Скрипт покажет:
- ✅ Если переменные настроены правильно
- ❌ Если что-то не так

---

## Важные моменты:

1. **Secret Key отличается от Bot Token** - это два разных ключа
2. **Secret Key выдается только при привязке домена** - его нельзя получить отдельно
3. **Если домен не привязан** - Secret Key не будет работать
4. **Secret Key должен быть в .env файле** - не в docker-compose.yml напрямую

---

## Если возникли проблемы:

1. Убедитесь что домен `nardist.site` действительно привязан к боту
2. Проверьте что в `.env` файле нет лишних пробелов вокруг `=`
3. Убедитесь что Secret Key скопирован полностью (он может быть длинным)
4. После изменения `.env` обязательно перезапустите backend: `docker-compose restart backend`

