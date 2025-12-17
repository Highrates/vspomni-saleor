#!/usr/bin/env python
"""
Скрипт для исправления неправильных transaction с завышенными суммами.
Исправляет transaction, где сумма больше суммы заказа в 10+ раз.
"""
import os
import sys
import django

# Настройка Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'saleor.settings')
django.setup()

from decimal import Decimal
from saleor.payment.models import TransactionItem
from saleor.order.models import Order
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_incorrect_transactions():
    """Исправляет transaction с неправильными суммами."""
    logger.info("Starting transaction fix...")
    
    # Находим все transaction, связанные с order
    transactions = TransactionItem.objects.filter(order__isnull=False).select_related('order')
    
    fixed_count = 0
    error_count = 0
    
    for trans in transactions:
        try:
            order = trans.order
            if not order:
                continue
            
            # Получаем сумму заказа в копейках
            order_total_cents = int(order.total_gross_amount * 100)
            
            # Проверяем charged_value (поле в базе данных)
            if trans.charged_value:
                trans_amount_cents = int(trans.charged_value)
                
                # Если сумма transaction больше суммы заказа в 10+ раз, это ошибка
                if trans_amount_cents > order_total_cents * 10:
                    logger.warning(
                        f"Order {order.id} (#{order.number}): "
                        f"Transaction {trans.id} has amount {trans_amount_cents} cents "
                        f"but order total is {order_total_cents} cents. "
                        f"Ratio: {trans_amount_cents / order_total_cents:.2f}x"
                    )
                    
                    # Исправляем сумму на правильную
                    trans.charged_value = Decimal(order_total_cents)
                    trans.save(update_fields=['charged_value'])
                    
                    logger.info(
                        f"Fixed transaction {trans.id} for order {order.id}: "
                        f"changed amount from {trans_amount_cents} to {order_total_cents} cents"
                    )
                    fixed_count += 1
                    
        except Exception as e:
            logger.error(f"Error processing transaction {trans.id}: {e}", exc_info=True)
            error_count += 1
    
    logger.info(f"Transaction fix completed. Fixed: {fixed_count}, Errors: {error_count}")
    return fixed_count, error_count

if __name__ == '__main__':
    fixed, errors = fix_incorrect_transactions()
    print(f"\n✅ Fixed {fixed} transactions")
    if errors > 0:
        print(f"⚠️  {errors} errors occurred")
    sys.exit(0 if errors == 0 else 1)
