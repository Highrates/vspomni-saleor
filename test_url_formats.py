#!/usr/bin/env python
"""Тестирование разных форматов URL для dj_email_url"""
import dj_email_url

test_urls = [
    "smtp://user:pass@smtp.go1.unisender.ru:587/?tls=True",
    "smtp://user:pass@smtp.go1.unisender.ru:587/?tls=1",
    "smtp://user:pass@smtp.go1.unisender.ru:587/?use_tls=1",
    "smtp://user:pass@smtp.go1.unisender.ru:587/?tls=true",
    "smtp://user:pass@smtp.go1.unisender.ru:465/?ssl=True",
    "smtp://user:pass@smtp.go1.unisender.ru:465/?ssl=1",
    "smtp://user:pass@smtp.go1.unisender.ru:465/?use_ssl=1",
]

print("Testing URL formats for dj_email_url:")
print("="*60)

for url in test_urls:
    print(f"\nURL: {url}")
    try:
        config = dj_email_url.parse(url)
        print(f"  Host: {config.get('EMAIL_HOST')}")
        print(f"  Port: {config.get('EMAIL_PORT')}")
        print(f"  TLS: {config.get('EMAIL_USE_TLS')}")
        print(f"  SSL: {config.get('EMAIL_USE_SSL')}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
