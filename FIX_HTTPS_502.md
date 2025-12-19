# Исправление ошибки 502 Bad Gateway на HTTPS

## Проблема
Домен `nardist.site` работает на HTTP, но на HTTPS выдает ошибку **502 Bad Gateway**.

## Причины
1. В HTTPS server блоке nginx отсутствуют location блоки для проксирования
2. SSL сертификат не настроен правильно
3. Контейнеры не слушают нужные порты

## Решение

### Шаг 1: Диагностика проблемы

Подключитесь к серверу по SSH и запустите диагностику:

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp  # или где находится ваш проект
chmod +x diagnose-https-issue.sh
./diagnose-https-issue.sh
```

Скрипт покажет:
- ✅ Что работает правильно
- ❌ Что нужно исправить

### Шаг 2: Автоматическое исправление

Запустите скрипт исправления:

```bash
chmod +x fix-https-502.sh
./fix-https-502.sh
```

Скрипт автоматически:
1. Проверит наличие SSL сертификата
2. Добавит/обновит HTTPS server блок в nginx
3. Добавит все необходимые location блоки для проксирования
4. Проверит синтаксис и перезагрузит nginx

### Шаг 3: Проверка работы

После исправления проверьте:

```bash
# Проверка HTTPS
curl -I https://nardist.site

# Проверка API
curl https://nardist.site/api/health

# Проверка frontend
curl -k https://nardist.site
```

## Ручное исправление (если скрипт не помог)

### 1. Проверьте конфигурацию nginx

```bash
nano /etc/nginx/vhosts/www-root/nardist.site.conf
```

### 2. Убедитесь, что есть HTTPS server блок

Должен быть блок примерно такого вида:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nardist.site www.nardist.site;

    ssl_certificate /etc/letsencrypt/live/nardist.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nardist.site/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ВАЖНО: Должны быть location блоки!
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Проверьте синтаксис и перезагрузите

```bash
nginx -t
systemctl reload nginx
```

## Если SSL сертификат отсутствует

Установите сертификат Let's Encrypt:

```bash
certbot --nginx -d nardist.site -d www.nardist.site
```

Или через ISPmanager:
1. WWW → nardist.site → SSL
2. Выберите "Let's Encrypt"
3. Нажмите "Выпустить"

## Проверка логов

Если проблема сохраняется, проверьте логи:

```bash
# Логи ошибок nginx
tail -f /var/log/nginx/nardist.site_error.log
tail -f /var/log/nginx/error.log

# Логи контейнеров
docker-compose logs --tail=50 frontend
docker-compose logs --tail=50 backend
```

## Частые проблемы

### Проблема: Контейнеры не запущены
```bash
cd /var/www/nardiphp  # путь к проекту
docker-compose ps
docker-compose up -d
```

### Проблема: Порты не слушаются
```bash
# Проверка портов
netstat -tlnp | grep -E '3000|5173'
# или
ss -tlnp | grep -E '3000|5173'

# Перезапуск контейнеров
docker-compose restart frontend backend
```

### Проблема: Неправильный путь к сертификату
Проверьте путь к сертификату:
```bash
ls -la /etc/letsencrypt/live/nardist.site/
```

Если сертификат в другом месте, обновите путь в конфигурации nginx.

## Готово! 🎉

После исправления сайт должен работать на https://nardist.site

