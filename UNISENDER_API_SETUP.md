# 📧 Настройка UniSender API для отправки email

## Описание

Плагин `UnisenderEmailPlugin` отправляет email через HTTP API UniSender вместо SMTP. Это решает проблемы с подключением SMTP и обеспечивает более надежную доставку.

## Преимущества

- ✅ Работает через HTTP (не требует SMTP подключения)
- ✅ Более надежная доставка
- ✅ Расширенная аналитика
- ✅ Нет проблем с DNS/TLS/SSL

## Настройка

### 1. Получите API ключ UniSender

1. Зарегистрируйтесь на https://www.unisender.com/ru/
2. Перейдите в настройки аккаунта
3. Найдите раздел "API ключ"
4. Скопируйте ваш API ключ

### 2. Настройте переменные окружения

Добавьте в `.env`:

```bash
# UniSender API Key (обязательно)
UNISENDER_API_KEY=ваш_api_ключ_unisender

# Email отправителя (обязательно, должен быть верифицирован в UniSender)
DEFAULT_FROM_EMAIL=your-email@example.com

# Имя отправителя (опционально)
UNISENDER_SENDER_NAME=Your Company Name
```

### 3. Настройте плагин

Запустите команду для создания и активации плагина:

```bash
docker exec -it saleor_api python3 manage.py setup_unisender_plugin
```

### 4. Активируйте плагин в Dashboard

1. Откройте Saleor Dashboard
2. Перейдите в **Configuration → Plugins**
3. Найдите **"UniSender Email (API)"**
4. Нажмите **Activate**
5. Заполните конфигурацию:
   - **API Key**: ваш UniSender API ключ
   - **Sender email**: email отправителя (должен быть верифицирован в UniSender)
   - **Sender name**: имя отправителя (опционально)

### 5. Деактивируйте старый SMTP плагин

Если у вас был активен `UserEmailPlugin` (SMTP), деактивируйте его:

1. В Dashboard → Configuration → Plugins
2. Найдите **"User emails"**
3. Нажмите **Deactivate**

## Проверка работы

После настройки попробуйте зарегистрировать нового пользователя - письмо с подтверждением должно прийти через UniSender API.

## Устранение проблем

### Плагин не появляется в Dashboard

Убедитесь, что плагин добавлен в `settings.PLUGINS`:

```python
BUILTIN_PLUGINS = [
    # ...
    "saleor.plugins.unisender.plugin.UnisenderEmailPlugin",
    # ...
]
```

### Email не отправляются

1. Проверьте логи Celery:
   ```bash
   docker compose logs saleor_celery_worker --tail=100 | grep -i unisender
   ```

2. Убедитесь, что API ключ правильный:
   ```bash
   docker exec -it saleor_api python3 manage.py shell -c "import os; print('API Key:', os.environ.get('UNISENDER_API_KEY', 'Not set')[:20] + '...')"
   ```

3. Проверьте, что email отправителя верифицирован в UniSender

### Ошибка "API key is required"

Убедитесь, что `UNISENDER_API_KEY` установлен в `.env` и контейнеры перезапущены:

```bash
docker compose restart
```

## Документация UniSender

- API документация: https://www.unisender.com/ru/support/api/
- Метод sendEmail: https://www.unisender.com/ru/support/api/messages/sendemail/

## Отличия от SMTP плагина

| Параметр | SMTP (UserEmailPlugin) | API (UnisenderEmailPlugin) |
|----------|------------------------|----------------------------|
| Протокол | SMTP (порт 587/465) | HTTP (HTTPS) |
| Настройки | host, port, username, password, TLS/SSL | api_key, sender_address, sender_name |
| Надежность | Зависит от SMTP сервера | Высокая (через API) |
| Аналитика | Ограниченная | Расширенная (в UniSender) |

## Миграция с SMTP на API

1. Настройте `UNISENDER_API_KEY` в `.env`
2. Запустите `setup_unisender_plugin`
3. Активируйте плагин в Dashboard
4. Деактивируйте старый SMTP плагин
5. Протестируйте отправку email
