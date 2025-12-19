# Настройка SSL сертификата через ISPmanager 6

## Вариант 1: Через ISPmanager (рекомендуется)

1. **Войдите в ISPmanager 6**
   - Откройте панель управления
   - Перейдите в раздел "WWW"

2. **Создайте домен** (если еще не создан):
   - Нажмите "Создать"
   - Домен: `nardist.site`
   - Документ корень: `/var/www/nardiphp/frontend/dist` (или оставьте по умолчанию)

3. **Настройте SSL через ISPmanager**:
   - Откройте домен `nardist.site`
   - Перейдите в раздел "SSL"
   - Выберите "Let's Encrypt"
   - Нажмите "Выпустить"
   - Дождитесь выпуска сертификата

4. **Настройте проксирование**:
   - В разделе "WWW" → домен `nardist.site`
   - Перейдите в "Настройки" → "Проксирование"
   - Добавьте проксирование:
     - **Backend API**: 
       - Путь: `/api`
       - Проксировать на: `http://localhost:3000`
     - **WebSocket**:
       - Путь: `/socket.io`
       - Проксировать на: `ws://localhost:3000`
     - **Frontend**:
       - Корневой путь: `/`
       - Проксировать на: `http://localhost:5173`

## Вариант 2: Через командную строку (если ISPmanager не работает)

```bash
# Установка certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Выпуск сертификата
certbot certonly --standalone -d nardist.site --non-interactive --agree-tos --email ваш@email.com

# После выпуска настройте в ISPmanager:
# SSL → Использовать существующий сертификат
# Путь: /etc/letsencrypt/live/nardist.site/
```

## Вариант 3: Автоматическое обновление через ISPmanager

ISPmanager 6 обычно автоматически обновляет Let's Encrypt сертификаты.
Убедитесь, что включено автоматическое обновление в настройках SSL.

## Проверка SSL

После настройки проверьте:
```bash
curl -I https://nardist.site
# Должен вернуть статус 200 или 301/302
```

## Важно для Telegram Mini App

Telegram требует:
- ✅ Валидный SSL сертификат (Let's Encrypt подходит)
- ✅ HTTPS (не HTTP)
- ✅ Домен должен быть доступен из интернета
- ✅ Сертификат должен быть привязан к правильному домену

Самоподписанный сертификат НЕ подойдет для Telegram Mini App!

