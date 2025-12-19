# Деплой через Git

## ✅ Код загружен в GitHub!

Репозиторий: https://github.com/Uz11ps/nardistv3

## Деплой на сервере

### Вариант 1: Автоматический скрипт

```bash
chmod +x deploy-git.sh
./deploy-git.sh
```

### Вариант 2: Ручной деплой через SSH

Подключитесь к серверу и выполните:

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp

# Если репозиторий уже есть - просто обновите
git pull origin main

# Если репозитория нет - клонируйте
cd /var/www
rm -rf nardiphp
git clone https://github.com/Uz11ps/nardistv3.git nardiphp
cd nardiphp

# Проверьте .env файл (должен существовать с вашими настройками)
# Если его нет - создайте из примера выше

# Пересборка
docker-compose down
docker-compose build --no-cache backend frontend
docker-compose up -d

# Проверка
docker-compose ps
docker-compose logs --tail=50 frontend
```

### Вариант 3: Быстрое обновление (только код)

Если нужно обновить только код без пересборки:

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp
git pull origin main
docker-compose restart backend frontend
```

## Структура репозитория

```
nardistv3/
├── backend/          # NestJS backend
│   └── src/
│       ├── clans/   # Новый модуль кланов
│       ├── games/   # Игровая логика
│       ├── users/   # Пользователи
│       └── ...
├── frontend/         # React frontend
│   └── src/
│       ├── components/  # Компоненты (Card, Button, BackgammonBoard)
│       ├── pages/       # Страницы (Game, Clans, History, etc.)
│       └── ...
├── docker-compose.yml
└── .gitignore
```

## Важные файлы в .gitignore

Следующие файлы НЕ загружаются в Git (и правильно):
- `.env` - секретные данные
- `node_modules/` - зависимости
- `dist/` и `build/` - собранные файлы
- Логи и временные файлы

## Обновление кода в будущем

1. **Локально:**
   ```bash
   git add .
   git commit -m "Описание изменений"
   git push origin main
   ```

2. **На сервере:**
   ```bash
   ssh root@91.229.9.80
   cd /var/www/nardiphp
   git pull origin main
   docker-compose build --no-cache backend frontend
   docker-compose up -d
   ```

## Проверка после деплоя

```bash
# Статус контейнеров
docker-compose ps

# Логи
docker-compose logs -f backend
docker-compose logs -f frontend

# Проверка работы
curl https://nardist.site/api/health
curl -I https://nardist.site
```

## Если что-то пошло не так

1. **Откат к предыдущему коммиту:**
   ```bash
   git log  # Найдите нужный коммит
   git checkout <commit-hash>
   docker-compose build --no-cache
   docker-compose up -d
   ```

2. **Проверка изменений:**
   ```bash
   git status
   git diff
   ```

3. **Принудительное обновление:**
   ```bash
   git fetch origin
   git reset --hard origin/main
   docker-compose build --no-cache
   docker-compose up -d
   ```

