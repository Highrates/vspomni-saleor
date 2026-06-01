# Ошибка 413 при загрузке MP4 / файлов в админке

**Симптом:** в консоли браузера `Failed to load resource: 413` на `https://vspomni.store/graphql/`.

**Причина:** Nginx (или прокси) отклоняет тело запроса — лимит по умолчанию **1 MB**, MP4 больше.

## Быстрое исправление на сервере

Подключитесь по SSH и выполните:

```bash
# Найти, где задан лимит
sudo grep -r client_max_body_size /etc/nginx/

# Открыть активный конфиг vspomni (имя файла может отличаться)
sudo nano /etc/nginx/sites-available/vspomni
# или: sudo nano /etc/nginx/sites-enabled/default
```

В блоке `server` для `vspomni.store` добавьте (или увеличьте):

```nginx
client_max_body_size 100M;
```

И **обязательно** в `location /graphql/`:

```nginx
location /graphql/ {
    client_max_body_size 100M;
    ...
}
```

Применить:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Django / Saleor API

В репозитории уже добавлено в `saleor/settings.py` (100 MB). После обновления кода Back:

```bash
cd ~/путь-к-back   # где docker-compose.yml
git pull
docker compose up -d --build api
```

## Проверка

Загрузите MP4 снова в сторис в dashboard. Если 413 остаётся — проверьте, нет ли CDN/Cloudflare с отдельным лимитом на размер тела запроса.
