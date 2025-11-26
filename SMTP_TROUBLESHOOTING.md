# 🔧 Устранение проблем с SMTP подключением

## Проблема: Зависание при отправке email, TLS: False

### Причина
`dj_email_url` не парсит `tls=True` или `ssl=True` правильно. Нужно использовать числовые значения: `tls=1` или `ssl=1`.

### Решение

1. **Проверьте текущий формат URL:**
   ```bash
   docker exec -it saleor_api python3 manage.py shell -c "import os; import dj_email_url; url = os.environ.get('USER_EMAIL_URL'); config = dj_email_url.parse(url) if url else None; print(f'TLS: {config.get(\"EMAIL_USE_TLS\")}, SSL: {config.get(\"EMAIL_USE_SSL\")}') if config else print('URL not found')"
   ```

2. **Исправьте формат URL в `.env`:**
   
   **Неправильно:**
   ```bash
   USER_EMAIL_URL=smtp://user:pass@smtp.go1.unisender.ru:587/?tls=True
   ```
   
   **Правильно:**
   ```bash
   USER_EMAIL_URL=smtp://user:pass@smtp.go1.unisender.ru:587/?tls=1
   ```
   
   Или для SSL (порт 465):
   ```bash
   USER_EMAIL_URL=smtp://user:pass@smtp.go1.unisender.ru:465/?ssl=1
   ```

3. **Варианты для Unisender:**
   
   **С TLS (порт 587):**
   ```bash
   USER_EMAIL_URL=smtp://user:pass@smtp.go1.unisender.ru:587/?tls=1
   # или
   USER_EMAIL_URL=smtp://user:pass@smtp.go2.unisender.ru:587/?tls=1
   ```
   
   **С SSL (порт 465):**
   ```bash
   USER_EMAIL_URL=smtp://user:pass@smtp.go1.unisender.ru:465/?ssl=1
   # или
   USER_EMAIL_URL=smtp://user:pass@smtp.go2.unisender.ru:465/?ssl=1
   ```

4. **Обновите конфигурацию плагина:**
   ```bash
   docker exec -it saleor_api python3 manage.py setup_user_email_plugin
   ```

5. **Протестируйте подключение:**
   ```bash
   docker exec -it saleor_api python3 manage.py test_smtp --timeout=30
   ```

### Диагностика

Если проблема сохраняется:

1. **Проверьте доступность хоста:**
   ```bash
   docker exec -it saleor_api ping -c 3 smtp.go1.unisender.ru
   ```

2. **Проверьте подключение к порту:**
   ```bash
   docker exec -it saleor_api python3 -c "import socket; sock = socket.create_connection(('smtp.go1.unisender.ru', 587), timeout=5); print('✅ Port 587 is reachable'); sock.close()"
   ```

3. **Проверьте логи Celery:**
   ```bash
   docker compose logs saleor_celery_worker --tail=100 | grep -i email
   ```

### Дополнительные команды

- **Тест с кастомным URL:**
  ```bash
  docker exec -it saleor_api python3 manage.py test_smtp --test-url="smtp://user:pass@host:587/?tls=1"
  ```

- **Проверка конфигурации плагина:**
  ```bash
  docker exec -it saleor_api python3 manage.py shell -c "from saleor.plugins.models import PluginConfiguration; from saleor.plugins.user_email.constants import PLUGIN_ID; pc = PluginConfiguration.objects.filter(identifier=PLUGIN_ID).first(); print('Active:', pc.active if pc else 'Not found'); [print(f'{item[\"name\"]}: {item[\"value\"]}') for item in (pc.configuration if pc else [])]"
  ```

### Важно

- `dj_email_url` использует **числовые значения**: `tls=1`, `ssl=1` (не `tls=True`, `ssl=True`)
- Порт **587** обычно требует **TLS**
- Порт **465** обычно требует **SSL**
- После изменения `.env` нужно перезапустить контейнеры: `docker compose restart`
