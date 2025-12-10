# Команды для создания и подтверждения тестовых пользователей

## Создать нового тестового пользователя test@gmail.com

```bash
docker exec -it saleor_api python3 manage.py create_test_user --email test@gmail.com --password Admin123456
```

Или через скрипт:
```bash
./create_test_user.sh
```

## Подтвердить существующего пользователя

```bash
docker exec -it saleor_api python3 manage.py create_test_user --email zet.develop@gmail.com --confirm-existing --password Admin123456
```

Или через скрипт:
```bash
./confirm_user.sh zet.develop@gmail.com
```

## Проверка логов после создания пользователя

```bash
docker logs saleor_api --tail 200
```

## Полный процесс на продакшне

```bash
# 1. Обновить код
git pull

# 2. Пересобрать и перезапустить контейнеры
docker compose down && docker compose up -d --build

# 3. Проверить nginx
nginx -t && systemctl reload nginx

# 4. Создать тестового пользователя
docker exec -it saleor_api python3 manage.py create_test_user --email test@gmail.com --password Admin123456

# 5. Проверить логи
docker logs saleor_api --tail 200
```

## Параметры команды

- `--email` - Email пользователя (по умолчанию: test@gmail.com)
- `--password` - Пароль пользователя (по умолчанию: Admin123456)
- `--confirm-existing` - Подтвердить email существующего пользователя вместо создания нового

## Примеры использования

### Создать пользователя с кастомным email и паролем:
```bash
docker exec -it saleor_api python3 manage.py create_test_user --email mytest@example.com --password MyPassword123
```

### Подтвердить несколько пользователей:
```bash
docker exec -it saleor_api python3 manage.py create_test_user --email user1@example.com --confirm-existing --password Admin123456
docker exec -it saleor_api python3 manage.py create_test_user --email user2@example.com --confirm-existing --password Admin123456
```

