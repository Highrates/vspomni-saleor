#!/usr/bin/env python
import os
import dj_email_url

# Проверка EMAIL_URL
email_url = os.environ.get("EMAIL_URL")
if email_url:
    print(f"✅ EMAIL_URL: {email_url[:50]}...")
    email_config = dj_email_url.parse(email_url)
    print(f"   Host: {email_config.get('EMAIL_HOST')}")
    print(f"   Port: {email_config.get('EMAIL_PORT')}")
    print(f"   User: {email_config.get('EMAIL_HOST_USER')}")
    print(f"   TLS: {email_config.get('EMAIL_USE_TLS')}")
    print(f"   SSL: {email_config.get('EMAIL_USE_SSL')}")
else:
    print("❌ EMAIL_URL не установлен")

# Проверка USER_EMAIL_URL
user_email_url = os.environ.get("USER_EMAIL_URL")
if user_email_url:
    print(f"\n✅ USER_EMAIL_URL: {user_email_url[:50]}...")
    user_email_config = dj_email_url.parse(user_email_url)
    print(f"   Host: {user_email_config.get('EMAIL_HOST')}")
    print(f"   Port: {user_email_config.get('EMAIL_PORT')}")
    print(f"   User: {user_email_config.get('EMAIL_HOST_USER')}")
    print(f"   TLS: {user_email_config.get('EMAIL_USE_TLS')}")
    print(f"   SSL: {user_email_config.get('EMAIL_USE_SSL')}")
else:
    print("\n❌ USER_EMAIL_URL не установлен")

print(f"\n✅ DEFAULT_FROM_EMAIL: {os.environ.get('DEFAULT_FROM_EMAIL', 'не установлен')}")
