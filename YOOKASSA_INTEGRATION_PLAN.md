# 💳 План интеграции с ЮКасса

## 📋 **Требования проекта**

### **Тип интеграции:**
- ✅ **Платежный шлюз** (прием платежей на сайте)
- ✅ **API для управления** (выводы, отчеты)

### **Сценарии использования:**
- ✅ **Онлайн платежи** (карты, СБП, электронные кошельки)

### **Технические детали:**
- ✅ **Тестовый и боевой режим** с возможностью переключения
- ✅ **Есть shopId и secretKey** от ЮКасса
- ✅ **Поддержка webhook'ов** для уведомлений

### **Функциональность:**
- ✅ **Автоматическое создание** платежей при оформлении заказа
- ❌ **Ручное создание** платежей в админке (не нужно)
- ✅ **Отслеживание статусов** платежей
- ✅ **Уведомления покупателей**

---

## 🎯 **Архитектура решения**

### **Выбранный подход: Плагин Saleor**
- Создать плагин в `saleor/plugins/yookassa/`
- Интегрировать с системой платежей Saleor
- Использовать существующую архитектуру
- Поддержка webhook'ов через Saleor

---

## 📅 **План реализации**

### **Этап 1: Подготовка и настройка (1-2 дня)**

#### **1.1 Установка зависимостей**
```bash
# Установка SDK ЮКасса
pip install yookassa

# Или через requirements.txt
echo "yookassa>=2.3.0" >> requirements.txt
```

#### **1.2 Создание структуры плагина**
```
saleor/plugins/yookassa/
├── __init__.py
├── plugin.py              # Основной класс плагина
├── api.py                 # API клиент ЮКасса
├── models.py              # Модели для хранения данных
├── webhooks.py            # Обработка webhook'ов
├── forms.py               # Формы для настроек
├── templates/             # Шаблоны
├── migrations/            # Миграции БД
└── tests/                 # Тесты
```

#### **1.3 Настройка конфигурации**
```python
# В settings.py или .env
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
YOOKASSA_TEST_MODE=True  # Переключение режимов
YOOKASSA_WEBHOOK_URL=https://yourdomain.com/webhooks/yookassa/
```

### **Этап 2: Базовый функционал (3-4 дня)**

#### **2.1 Создание API клиента**
```python
# saleor/plugins/yookassa/api.py
from yookassa import Configuration, Payment
import uuid

class YooKassaAPI:
    def __init__(self, shop_id, secret_key, test_mode=True):
        Configuration.account_id = shop_id
        Configuration.secret_key = secret_key
        self.test_mode = test_mode
    
    def create_payment(self, amount, currency, order_id, return_url):
        payment = Payment.create({
            "amount": {
                "value": str(amount),
                "currency": currency
            },
            "confirmation": {
                "type": "redirect",
                "return_url": return_url
            },
            "capture": True,
            "description": f"Order {order_id}",
            "metadata": {
                "order_id": str(order_id)
            }
        })
        return payment
```

#### **2.2 Создание модели платежа**
```python
# saleor/plugins/yookassa/models.py
from django.db import models
from saleor.order.models import Order

class YooKassaPayment(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE)
    payment_id = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'yookassa_payments'
```

#### **2.3 Основной класс плагина**
```python
# saleor/plugins/yookassa/plugin.py
from saleor.payment import GatewayConfig, Gateway
from .api import YooKassaAPI

class YooKassaPlugin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.api = YooKassaAPI(
            shop_id=settings.YOOKASSA_SHOP_ID,
            secret_key=settings.YOOKASSA_SECRET_KEY,
            test_mode=settings.YOOKASSA_TEST_MODE
        )
    
    def process_payment(self, payment_information, previous_value):
        # Создание платежа в ЮКасса
        payment = self.api.create_payment(
            amount=payment_information.amount,
            currency=payment_information.currency,
            order_id=payment_information.order_id,
            return_url=payment_information.return_url
        )
        
        # Сохранение в БД
        YooKassaPayment.objects.create(
            order=payment_information.order,
            payment_id=payment.id,
            status=payment.status,
            amount=payment_information.amount,
            currency=payment_information.currency
        )
        
        return Gateway(
            transaction_id=payment.id,
            is_success=True,
            kind=TransactionKind.CAPTURE,
            amount=payment_information.amount,
            currency=payment_information.currency,
            error=None,
            raw_response=payment.dict()
        )
```

### **Этап 3: Webhook'и и уведомления (2-3 дня)**

#### **3.1 Обработка webhook'ов**
```python
# saleor/plugins/yookassa/webhooks.py
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
import json
from yookassa import Webhook

@csrf_exempt
def yookassa_webhook(request):
    if request.method == 'POST':
        event_json = json.loads(request.body)
        
        # Проверка подписи webhook'а
        if Webhook.validate(event_json):
            event = event_json['event']
            payment_id = event['object']['id']
            
            # Обновление статуса платежа
            try:
                payment = YooKassaPayment.objects.get(payment_id=payment_id)
                payment.status = event['object']['status']
                payment.save()
                
                # Обновление статуса заказа
                if event['object']['status'] == 'succeeded':
                    payment.order.payment_status = 'paid'
                    payment.order.save()
                    
                    # Отправка уведомления покупателю
                    send_payment_success_notification(payment.order)
                    
            except YooKassaPayment.DoesNotExist:
                pass
                
        return HttpResponse(status=200)
    return HttpResponse(status=405)
```

#### **3.2 Уведомления покупателей**
```python
# saleor/plugins/yookassa/notifications.py
from saleor.core.notifications import send_email

def send_payment_success_notification(order):
    send_email(
        to=[order.user_email],
        subject="Платеж успешно проведен",
        template="yookassa/payment_success.html",
        context={"order": order}
    )

def send_payment_failed_notification(order):
    send_email(
        to=[order.user_email],
        subject="Ошибка платежа",
        template="yookassa/payment_failed.html",
        context={"order": order}
    )
```

### **Этап 4: UI/UX и шаблоны (2-3 дня)**

#### **4.1 Страница оплаты**
```html
<!-- templates/yookassa/payment_form.html -->
<div class="yookassa-payment">
    <h2>Оплата заказа #{{ order.id }}</h2>
    <p>Сумма: {{ order.total }} {{ order.currency }}</p>
    
    <form method="post" action="{% url 'yookassa:create_payment' %}">
        {% csrf_token %}
        <input type="hidden" name="order_id" value="{{ order.id }}">
        <button type="submit" class="btn btn-primary">
            Перейти к оплате
        </button>
    </form>
</div>
```

#### **4.2 Шаблоны уведомлений**
```html
<!-- templates/yookassa/payment_success.html -->
<h1>Платеж успешно проведен!</h1>
<p>Ваш заказ #{{ order.id }} оплачен.</p>
<p>Сумма: {{ order.total }} {{ order.currency }}</p>
```

### **Этап 5: Тестирование и отладка (2-3 дня)**

#### **5.1 Unit тесты**
```python
# tests/test_yookassa.py
import pytest
from unittest.mock import patch, Mock
from saleor.plugins.yookassa.plugin import YooKassaPlugin

class TestYooKassaPlugin:
    def test_create_payment(self):
        plugin = YooKassaPlugin()
        payment_info = Mock()
        payment_info.amount = 100.00
        payment_info.currency = 'RUB'
        payment_info.order_id = 123
        
        with patch('saleor.plugins.yookassa.api.YooKassaAPI.create_payment') as mock_create:
            mock_create.return_value = Mock(id='test_payment_id', status='pending')
            
            result = plugin.process_payment(payment_info, None)
            
            assert result.is_success is True
            assert result.transaction_id == 'test_payment_id'
```

#### **5.2 Интеграционные тесты**
- Тестирование создания платежей
- Тестирование webhook'ов
- Тестирование уведомлений
- Тестирование переключения режимов

### **Этап 6: Документация и развертывание (1-2 дня)**

#### **6.1 Настройка в админке**
- Добавление плагина в список доступных
- Настройка параметров (ключи, режимы)
- Тестирование в тестовом режиме

#### **6.2 Развертывание**
- Миграции БД
- Настройка webhook URL в ЮКасса
- Переключение на боевой режим

---

## 🔧 **Технические детали**

### **Зависимости:**
```python
# requirements.txt
yookassa>=2.3.0
django>=3.2
requests>=2.25.0
```

### **Настройки Django:**
```python
# settings.py
INSTALLED_APPS = [
    # ... existing apps
    'saleor.plugins.yookassa',
]

# YooKassa настройки
YOOKASSA_SHOP_ID = os.getenv('YOOKASSA_SHOP_ID')
YOOKASSA_SECRET_KEY = os.getenv('YOOKASSA_SECRET_KEY')
YOOKASSA_TEST_MODE = os.getenv('YOOKASSA_TEST_MODE', 'True').lower() == 'true'
YOOKASSA_WEBHOOK_URL = os.getenv('YOOKASSA_WEBHOOK_URL')
```

### **URL маршруты:**
```python
# urls.py
urlpatterns = [
    path('yookassa/', include('saleor.plugins.yookassa.urls')),
]
```

---

## 📊 **Мониторинг и логирование**

### **Логирование:**
- Создание платежей
- Обработка webhook'ов
- Ошибки API
- Уведомления

### **Метрики:**
- Количество успешных платежей
- Количество неудачных платежей
- Время обработки
- Статусы платежей

---

## 🚀 **План развертывания**

### **Неделя 1:**
- День 1-2: Этап 1 (Подготовка)
- День 3-5: Этап 2 (Базовый функционал)
- День 6-7: Этап 3 (Webhook'и)

### **Неделя 2:**
- День 1-3: Этап 4 (UI/UX)
- День 4-5: Этап 5 (Тестирование)
- День 6-7: Этап 6 (Развертывание)

---

## ✅ **Критерии готовности**

### **Функциональные:**
- ✅ Создание платежей при оформлении заказа
- ✅ Обработка webhook'ов от ЮКасса
- ✅ Обновление статусов заказов
- ✅ Уведомления покупателей
- ✅ Переключение тестовый/боевой режим

### **Технические:**
- ✅ Unit тесты (покрытие >80%)
- ✅ Интеграционные тесты
- ✅ Логирование и мониторинг
- ✅ Документация
- ✅ Безопасность (валидация webhook'ов)

---

## 🔒 **Безопасность**

### **Меры безопасности:**
- Валидация подписи webhook'ов
- Шифрование чувствительных данных
- Логирование всех операций
- Ограничение доступа к API
- Регулярное обновление зависимостей

---

**🎯 Итого: 2 недели разработки + тестирование**

**📞 Вопросы для уточнения:**
1. Нужна ли поддержка возвратов?
2. Какие способы оплаты приоритетны?
3. Нужна ли интеграция с аналитикой?
4. Есть ли требования к дизайну страницы оплаты?
