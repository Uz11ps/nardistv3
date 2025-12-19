# Ручное исправление Nginx конфигурации

## Шаг 1: Просмотр текущей конфигурации

```bash
cd /var/www/nardiphp
chmod +x show-nginx-config.sh
./show-nginx-config.sh
```

## Шаг 2: Ручное редактирование

Откройте файл конфигурации:

```bash
nano /etc/nginx/vhosts/www-root/nardist.site.conf
```

## Шаг 3: Найдите server блок для nardist.site

Найдите строку с `server_name nardist.site;` или `server_name *.nardist.site;`

## Шаг 4: Удалите ВСЕ location блоки внутри server блока

Удалите все строки, которые начинаются с `location` до их закрывающей скобки `}`

## Шаг 5: Добавьте правильные location блоки

Перед закрывающей скобкой `}` server блока добавьте:

```nginx
    location /api {
        rewrite ^/api(.*)$ $1 break;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }

    location /socket.io {
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

    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
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
        proxy_redirect off;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
```

## Шаг 6: Проверка синтаксиса

```bash
nginx -t
```

Если ошибок нет, перезагрузите Nginx:

```bash
systemctl reload nginx
```

## Шаг 7: Проверка работы

```bash
curl http://nardist.site | head -20
curl http://nardist.site/api/health
```

## Важно:

1. **Отступы**: Все location блоки должны иметь одинаковый отступ (обычно 4 пробела)
2. **Порядок**: location блоки должны быть ПЕРЕД закрывающей скобкой `}` server блока
3. **Один server блок**: Убедитесь, что вы редактируете правильный server блок для nardist.site

