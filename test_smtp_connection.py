#!/usr/bin/env python
"""
Диагностический скрипт для проверки SMTP подключения
"""
import os
import socket
import sys
import time
from contextlib import contextmanager

import dj_email_url
from django.core.mail import send_mail
from django.core.mail.backends.smtp import EmailBackend
from django.conf import settings

# Настройка Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "saleor.settings")
import django
django.setup()


@contextmanager
def timeout_context(seconds):
    """Контекстный менеджер для таймаута"""
    import signal
    
    def timeout_handler(signum, frame):
        raise TimeoutError(f"Operation timed out after {seconds} seconds")
    
    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)


def check_host_connectivity(host, port, timeout=5):
    """Проверка доступности хоста и порта"""
    print(f"\n🔍 Проверка доступности {host}:{port}...")
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.close()
        print(f"✅ Хост {host}:{port} доступен")
        return True
    except socket.gaierror as e:
        print(f"❌ DNS ошибка для {host}: {e}")
        return False
    except socket.timeout:
        print(f"❌ Таймаут подключения к {host}:{port}")
        return False
    except Exception as e:
        print(f"❌ Ошибка подключения к {host}:{port}: {e}")
        return False


def test_email_url_parsing():
    """Тестирование парсинга EMAIL_URL"""
    print("\n" + "="*60)
    print("📋 Тестирование парсинга USER_EMAIL_URL")
    print("="*60)
    
    email_url = os.environ.get("USER_EMAIL_URL")
    if not email_url:
        print("❌ USER_EMAIL_URL не установлен")
        return None
    
    print(f"📝 USER_EMAIL_URL: {email_url[:80]}...")
    
    # Пробуем разные варианты парсинга
    config = dj_email_url.parse(email_url)
    
    print(f"\n📊 Результаты парсинга:")
    print(f"   Host: {config.get('EMAIL_HOST')}")
    print(f"   Port: {config.get('EMAIL_PORT')}")
    print(f"   User: {config.get('EMAIL_HOST_USER')}")
    print(f"   Password: {'*' * len(config.get('EMAIL_HOST_PASSWORD', ''))}")
    print(f"   TLS: {config.get('EMAIL_USE_TLS')}")
    print(f"   SSL: {config.get('EMAIL_USE_SSL')}")
    print(f"   Backend: {config.get('EMAIL_BACKEND')}")
    
    # Если TLS не установлен, попробуем исправить
    if not config.get('EMAIL_USE_TLS') and not config.get('EMAIL_USE_SSL'):
        print("\n⚠️  TLS/SSL не установлен в конфигурации!")
        print("   Попробуйте использовать один из форматов:")
        print("   - smtp://user:pass@host:587/?tls=1")
        print("   - smtp://user:pass@host:587/?use_tls=1")
        print("   - smtp://user:pass@host:465/?ssl=1")
        print("   - smtp://user:pass@host:465/?use_ssl=1")
    
    return config


def test_smtp_connection_with_timeout(config, timeout=30):
    """Тестирование SMTP подключения с таймаутом"""
    print("\n" + "="*60)
    print("📧 Тестирование SMTP подключения")
    print("="*60)
    
    if not config:
        print("❌ Нет конфигурации для тестирования")
        return False
    
    host = config.get('EMAIL_HOST')
    port = config.get('EMAIL_PORT')
    
    # Проверяем доступность хоста
    if not check_host_connectivity(host, port):
        return False
    
    # Создаем backend с явными настройками
    print(f"\n🔧 Создание SMTP backend...")
    print(f"   Host: {host}")
    print(f"   Port: {port}")
    print(f"   TLS: {config.get('EMAIL_USE_TLS', False)}")
    print(f"   SSL: {config.get('EMAIL_USE_SSL', False)}")
    
    # Если TLS не установлен, но порт 587, принудительно включаем TLS
    use_tls = config.get('EMAIL_USE_TLS', False)
    use_ssl = config.get('EMAIL_USE_SSL', False)
    
    if port == 587 and not use_tls and not use_ssl:
        print("⚠️  Порт 587 обычно требует TLS. Включаем TLS принудительно...")
        use_tls = True
    
    if port == 465 and not use_ssl and not use_tls:
        print("⚠️  Порт 465 обычно требует SSL. Включаем SSL принудительно...")
        use_ssl = True
    
    backend = EmailBackend(
        host=host,
        port=port,
        username=config.get('EMAIL_HOST_USER'),
        password=config.get('EMAIL_HOST_PASSWORD'),
        use_ssl=use_ssl,
        use_tls=use_tls,
        timeout=10,  # Таймаут подключения
    )
    
    # Пробуем отправить тестовое письмо с таймаутом
    print(f"\n📤 Попытка отправки тестового письма (таймаут: {timeout} сек)...")
    test_email = os.environ.get('DEFAULT_FROM_EMAIL', 'ap7.atb@gmail.com')
    
    try:
        # Используем таймаут через signal (только на Unix)
        if sys.platform != 'win32':
            with timeout_context(timeout):
                send_mail(
                    'Test Email',
                    'This is a test message from Saleor SMTP diagnostic script.',
                    test_email,
                    [test_email],
                    connection=backend,
                    fail_silently=False,
                )
        else:
            # На Windows используем threading timeout
            import threading
            result = [None]
            exception = [None]
            
            def send():
                try:
                    result[0] = send_mail(
                        'Test Email',
                        'This is a test message from Saleor SMTP diagnostic script.',
                        test_email,
                        [test_email],
                        connection=backend,
                        fail_silently=False,
                    )
                except Exception as e:
                    exception[0] = e
            
            thread = threading.Thread(target=send)
            thread.daemon = True
            thread.start()
            thread.join(timeout)
            
            if thread.is_alive():
                print(f"❌ Отправка зависла (таймаут {timeout} сек)")
                return False
            
            if exception[0]:
                raise exception[0]
            
            if result[0]:
                print("✅ Тестовое письмо отправлено успешно!")
                return True
            else:
                print("❌ Отправка не удалась (результат: None)")
                return False
                
    except TimeoutError:
        print(f"❌ Таймаут при отправке (превышен лимит {timeout} сек)")
        print("   Возможные причины:")
        print("   - Неправильные настройки TLS/SSL")
        print("   - Проблемы с сетью")
        print("   - Неправильный хост или порт")
        return False
    except Exception as e:
        print(f"❌ Ошибка при отправке: {type(e).__name__}: {e}")
        print("\n💡 Рекомендации:")
        if "TLS" in str(e) or "SSL" in str(e):
            print("   - Проверьте настройки TLS/SSL")
            print("   - Попробуйте использовать порт 465 с SSL вместо 587 с TLS")
        if "authentication" in str(e).lower() or "login" in str(e).lower():
            print("   - Проверьте правильность логина и пароля")
        if "connection" in str(e).lower() or "refused" in str(e).lower():
            print("   - Проверьте доступность хоста и порта")
            print("   - Проверьте firewall настройки")
        return False
    
    print("✅ Тестовое письмо отправлено успешно!")
    return True


def suggest_fixes(config):
    """Предложения по исправлению"""
    print("\n" + "="*60)
    print("💡 Рекомендации")
    print("="*60)
    
    if not config:
        return
    
    host = config.get('EMAIL_HOST', '')
    port = config.get('EMAIL_PORT', '')
    use_tls = config.get('EMAIL_USE_TLS', False)
    use_ssl = config.get('EMAIL_USE_SSL', False)
    
    print("\n📝 Варианты формата USER_EMAIL_URL:")
    
    if 'unisender' in host.lower():
        print("\nДля Unisender попробуйте:")
        print("1. С TLS (порт 587):")
        print("   USER_EMAIL_URL=smtp://user:pass@smtp.go1.unisender.ru:587/?tls=1")
        print("   или")
        print("   USER_EMAIL_URL=smtp://user:pass@smtp.go2.unisender.ru:587/?tls=1")
        print("\n2. С SSL (порт 465):")
        print("   USER_EMAIL_URL=smtp://user:pass@smtp.go1.unisender.ru:465/?ssl=1")
        print("   или")
        print("   USER_EMAIL_URL=smtp://user:pass@smtp.go2.unisender.ru:465/?ssl=1")
    
    if port == 587 and not use_tls:
        print(f"\n⚠️  Порт {port} обычно требует TLS.")
        print("   Добавьте в URL: ?tls=1 или ?use_tls=1")
    
    if port == 465 and not use_ssl:
        print(f"\n⚠️  Порт {port} обычно требует SSL.")
        print("   Добавьте в URL: ?ssl=1 или ?use_ssl=1")
    
    print("\n📚 Документация dj_email_url:")
    print("   https://github.com/migonzalvar/dj-email-url")
    print("   Формат: smtp://user:pass@host:port/?tls=1&ssl=0")


if __name__ == "__main__":
    print("="*60)
    print("🔧 SMTP Connection Diagnostic Tool")
    print("="*60)
    
    config = test_email_url_parsing()
    
    if config:
        success = test_smtp_connection_with_timeout(config, timeout=30)
        if not success:
            suggest_fixes(config)
    else:
        print("\n❌ Не удалось получить конфигурацию. Проверьте USER_EMAIL_URL в .env")

