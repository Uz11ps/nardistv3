# Исправление конфликта Nginx и Apache

## Проблема

Backend успешно запущен, но:
- `curl http://nardist.site` показывает дефолтную страницу ISPmanager
- `curl http://nardist.site/api/health` возвращает 404 от Apache

Это означает, что Apache перехватывает запросы вместо Nginx.

## Решение

### Вариант 1: Отключить Apache (рекомендуется)

Если вы используете только Nginx:

```bash
ssh root@91.229.9.80

# Остановить Apache
systemctl stop apache2
systemctl disable apache2

# Убедиться что Nginx запущен
systemctl start nginx
systemctl enable nginx

# Перезагрузить Nginx
systemctl reload nginx

# Проверить
curl http://nardist.site
curl http://nardist.site/api/health
```

### Вариант 2: Настроить Apache для проксирования

Если Apache нужен для других сайтов, настройте его для проксирования на Docker:

```bash
ssh root@91.229.9.80

# Создать конфигурацию Apache
nano /etc/apache2/sites-available/nardist.conf
```

Вставьте:

```apache
<VirtualHost *:80>
    ServerName nardist.site
    ServerAlias www.nardist.site

    # Frontend
    ProxyPreserveHost On
    ProxyPass / http://localhost:5173/
    ProxyPassReverse / http://localhost:5173/

    # Backend API
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api

    # WebSocket
    ProxyPass /socket.io ws://localhost:3000/socket.io
    ProxyPassReverse /socket.io ws://localhost:3000/socket.io
</VirtualHost>
```

Включите модули и сайт:

```bash
a2enmod proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2ensite nardist
systemctl reload apache2
```

### Вариант 3: Использовать только Nginx (лучший вариант)

Если у вас только один сайт, используйте только Nginx:

```bash
ssh root@91.229.9.80

# Проверить что Nginx слушает порт 80
ss -tlnp | grep :80

# Если Apache слушает порт 80, остановите его
systemctl stop apache2
systemctl disable apache2

# Убедитесь что Nginx слушает порт 80
systemctl restart nginx

# Проверьте конфигурацию
nginx -t

# Перезагрузите
systemctl reload nginx
```

## Проверка

После исправления проверьте:

```bash
# Проверка портов
ss -tlnp | grep -E ':80|:443|:3000|:5173'

# Проверка frontend
curl http://localhost:5173

# Проверка backend
curl http://localhost:3000/health

# Проверка через домен
curl http://nardist.site
curl http://nardist.site/api/health
```

## Если ничего не помогает

Проверьте конфигурацию ISPmanager:

1. Войдите в ISPmanager: https://91.229.9.80:1500
2. Перейдите в WWW → nardist.site
3. Проверьте настройки веб-сервера
4. Убедитесь что выбран Nginx (не Apache)
5. Сохраните и перезагрузите

Или используйте автоматический скрипт:

```bash
chmod +x fix-nginx-apache.sh
./fix-nginx-apache.sh
```

