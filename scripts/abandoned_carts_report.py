#!/usr/bin/env python
"""
Скрипт для анализа брошенных корзин в Saleor.

Использование:
    uv run python scripts/abandoned_carts_report.py
"""

import os
import sys
import django
from datetime import datetime, timedelta
from decimal import Decimal

# Настройка Django окружения
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "saleor.settings")
django.setup()

from django.utils import timezone
from django.db.models import Count, Sum, Q
from saleor.checkout.models import Checkout


def get_abandoned_checkouts(hours_threshold=24, max_days=30):
    """
    Получить брошенные корзины.
    
    Args:
        hours_threshold: Минимальное время неактивности (в часах)
        max_days: Максимальный возраст корзины (в днях)
    
    Returns:
        QuerySet брошенных корзин
    """
    now = timezone.now()
    min_age = now - timedelta(hours=hours_threshold)
    max_age = now - timedelta(days=max_days)
    
    abandoned = Checkout.objects.filter(
        last_change__lt=min_age,
        last_change__gte=max_age,
    ).annotate(
        lines_count=Count('lines')
    ).filter(
        lines_count__gt=0  # Есть товары
    ).exclude(
        Q(email__isnull=True) & Q(user__isnull=True)  # Есть контакт
    ).select_related('user', 'channel').prefetch_related('lines__variant__product')
    
    return abandoned


def print_report():
    """Вывести отчёт по брошенным корзинам."""
    print("\n" + "=" * 80)
    print("📊 ОТЧЁТ ПО БРОШЕННЫМ КОРЗИНАМ")
    print("=" * 80)
    
    # Категории по времени
    now = timezone.now()
    
    categories = [
        ("🔥 ГОРЯЧИЕ (1-24 часа)", 1, 24/24),
        ("🟡 ТЁПЛЫЕ (1-7 дней)", 24, 7),
        ("🔵 ХОЛОДНЫЕ (7-30 дней)", 24*7, 30),
    ]
    
    total_abandoned = 0
    total_revenue = Decimal(0)
    
    for label, min_hours, max_days in categories:
        checkouts = get_abandoned_checkouts(min_hours, max_days)
        count = checkouts.count()
        total_abandoned += count
        
        if count > 0:
            # Подсчёт потенциальной выручки
            revenue = sum(
                sum(line.total_price_gross_amount for line in checkout.lines.all())
                for checkout in checkouts
            )
            total_revenue += revenue
            
            print(f"\n{label}")
            print(f"  Количество: {count}")
            print(f"  Потенциальная выручка: {revenue:,.2f} RUB")
            
            # Показать первые 3 примера
            for i, checkout in enumerate(checkouts[:3], 1):
                email = checkout.get_customer_email() or "Нет email"
                items = checkout.lines.count()
                total = sum(line.total_price_gross_amount for line in checkout.lines.all())
                days_ago = (now - checkout.last_change).days
                hours_ago = (now - checkout.last_change).seconds // 3600
                
                time_str = f"{days_ago}д {hours_ago}ч" if days_ago > 0 else f"{hours_ago}ч"
                
                print(f"    {i}. {email} | {items} товаров | {total} RUB | {time_str} назад")
        else:
            print(f"\n{label}")
            print(f"  Количество: 0")
    
    print("\n" + "=" * 80)
    print(f"📈 ИТОГО:")
    print(f"   Брошенных корзин: {total_abandoned}")
    print(f"   Потенциальная выручка: {total_revenue:,.2f} RUB")
    print("=" * 80)
    
    # Рекомендации
    if total_abandoned > 0:
        print("\n💡 РЕКОМЕНДАЦИИ:")
        print("   1. Отправить email-напоминания горячим корзинам")
        print("   2. Предложить промокод тёплым корзинам")
        print("   3. Специальное предложение холодным корзинам")
    else:
        print("\n✅ Нет брошенных корзин!")
    print()


def get_abandoned_by_product():
    """Показать топ товаров в брошенных корзинах."""
    abandoned = get_abandoned_checkouts(24, 30)
    
    product_stats = {}
    for checkout in abandoned:
        for line in checkout.lines.all():
            product_name = line.variant.product.name
            if product_name not in product_stats:
                product_stats[product_name] = {
                    'count': 0,
                    'total_quantity': 0,
                    'revenue': Decimal(0)
                }
            
            product_stats[product_name]['count'] += 1
            product_stats[product_name]['total_quantity'] += line.quantity
            product_stats[product_name]['revenue'] += line.total_price_gross_amount
    
    if product_stats:
        print("\n" + "=" * 80)
        print("🏆 ТОП ТОВАРОВ В БРОШЕННЫХ КОРЗИНАХ")
        print("=" * 80)
        
        # Сортировка по количеству корзин
        sorted_products = sorted(
            product_stats.items(),
            key=lambda x: x[1]['count'],
            reverse=True
        )
        
        for i, (product, stats) in enumerate(sorted_products[:10], 1):
            print(f"{i}. {product}")
            print(f"   В {stats['count']} корзинах | "
                  f"Всего единиц: {stats['total_quantity']} | "
                  f"Сумма: {stats['revenue']:,.2f} RUB")
        
        print("=" * 80)


if __name__ == "__main__":
    print_report()
    get_abandoned_by_product()

