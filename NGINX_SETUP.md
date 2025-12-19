# Настройка Nginx для nardist.site

## Проблема

На странице https://nardist.site/ показывается стандартное сообщение ISPmanager "Сайт только что создан", потому что Nginx не настроен для проксирования на Docker контейнеры.

## Решение

### Вариант 1: Автоматический скрипт

```bash
chmod +x setup-nginx.sh
./setup-nginx.sh
```

### Вариант 2: Ручная настройка через SSH

```bash
ssh root@91.229.9.80
```

Создайте конфигурацию Nginx:

```bash
nano /etc/nginx/conf.d/nardist.conf
```

Вставьте следующую конфигурацию:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name nardist.site www.nardist.site;

    # Логи
    access_log /var/log/nginx/nardist_access.log;
    error_log /var/log/nginx/nardist_error.log;

    # Frontend (React приложение)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Таймауты для WebSocket
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API
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
        
        # Увеличенные таймауты для API
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket для Socket.IO
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты для WebSocket
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X) и проверьте конфигурацию:

```bash
nginx -t
```

Если всё ок, перезагрузите Nginx:

```bash
systemctl reload nginx
# или
systemctl restart nginx
```

### Вариант 3: Через ISPmanager

1. Войдите в ISPmanager: https://91.229.9.80:1500
2. Перейдите в раздел "WWW"
3. Найдите домен `nardist.site`
4. Нажмите "Настройки"
5. В разделе "Nginx" добавьте кастомную конфигурацию (как выше)
6. Сохраните и перезагрузите Nginx

## Проверка работы

После настройки проверьте:

```bash
# Статус контейнеров
cd /var/www/nardiphp
docker-compose ps

# Логи frontend
docker-compose logs --tail=20 frontend

# Логи backend
docker-compose logs --tail=20 backend

# Проверка доступности
curl http://localhost:5173
curl http://localhost:3000/health

# Проверка через домен
curl http://nardist.site
curl http://nardist.site/api/health
```

## Настройка SSL (HTTPS)

После того как всё заработает на HTTP, настройте HTTPS:

```bash
ssh root@91.229.9.80
certbot --nginx -d nardist.site -d www.nardist.site
```

Или через ISPmanager:
1. WWW → nardist.site → SSL
2. Включите "Let's Encrypt"
3. Сохраните

## Если что-то не работает

### Проверьте логи Nginx:

```bash
tail -f /var/log/nginx/nardist_error.log
tail -f /var/log/nginx/nardist_access.log
```

### Проверьте, что контейнеры запущены:

```bash
docker-compose ps
docker-compose logs frontend
docker-compose logs backend
```

### Проверьте порты:

```bash
netstat -tlnp | grep -E '5173|3000'
# или
ss -tlnp | grep -E '5173|3000'
```

### Если порты не слушаются:

```bash
cd /var/www/nardiphp
docker-compose restart frontend backend
docker-compose logs --tail=50 frontend
docker-compose logs --tail=50 backend
```

## Готово! 🎉

После настройки сайт должен работать на http://nardist.site и https://nardist.site

