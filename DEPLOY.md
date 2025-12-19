# Инструкция по деплою на ISPmanager 6

## Подготовка сервера

1. Подключитесь к серверу по SSH:
```bash
ssh root@91.229.9.80
```

2. Установите Docker и Docker Compose (если не установлены):
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

3. Клонируйте репозиторий:
```bash
cd /var/www
git clone <your-repo-url> nardiphp
cd nardiphp
```

4. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
nano .env
```

Заполните переменные:
- `TELEGRAM_BOT_TOKEN` - токен бота от @BotFather
- `TELEGRAM_SECRET_KEY` - секретный ключ из настроек бота
- `DOMAIN` - ваш домен
- `POSTGRES_PASSWORD` - надежный пароль для БД
- `JWT_SECRET` - случайная строка минимум 32 символа

5. Запустите деплой:
```bash
bash deploy/deploy.sh
```

## Настройка ISPmanager 6

1. Войдите в панель ISPmanager 6
2. Создайте домен или используйте существующий
3. Настройте SSL сертификат (Let's Encrypt)
4. Настройте проксирование:
   - Backend: `http://localhost:3000`
   - Frontend: `http://localhost:5173`

## Настройка Telegram бота

1. Создайте бота через @BotFather
2. Получите токен бота
3. Настройте Web App:
   - URL: `https://your-domain.com`
   - Добавьте в `.env` токен и секретный ключ

## Проверка работы

После деплоя проверьте:
- Backend API: `http://your-domain.com:3000/health`
- Frontend: `http://your-domain.com:5173`

