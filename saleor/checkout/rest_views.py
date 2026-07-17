"""
Custom REST API views for checkout creation without stock validation.
This bypasses the standard checkout creation flow to avoid stock availability issues.
"""
import json
import logging
import graphene
from decimal import Decimal

from django.db import transaction
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from ..checkout.utils import (
    add_promo_code_to_checkout,
)
from ..checkout.fetch import (
    fetch_checkout_info,
    fetch_checkout_lines,
)
from ..plugins.manager import get_plugins_manager
from ..core.exceptions import PermissionDenied
from ..core.utils.promo_code import InvalidPromoCode
from ..checkout import models as checkout_models
from ..channel.models import Channel
from ..product import models as product_models

logger = logging.getLogger(__name__)


def _confirmation_email_already_sent(order) -> bool:
    from ..order import OrderEvents, OrderEventsEmails
    from ..order.models import OrderEvent

    return OrderEvent.objects.filter(
        order_id=order.pk,
        type=OrderEvents.EMAIL_SENT,
        parameters__email_type=OrderEventsEmails.ORDER_CONFIRMATION,
    ).exists()


def _ensure_checkout_email(checkout, user_email: str | None):
    if not user_email:
        return

    normalized_email = user_email.strip().lower()
    if not normalized_email:
        return

    update_fields = []
    if checkout.email != normalized_email:
        checkout.email = normalized_email
        update_fields.append("email")

    if not checkout.user:
        from ..account.utils import retrieve_user_by_email

        try:
            user = retrieve_user_by_email(normalized_email)
            if user:
                checkout.user = user
                update_fields.append("user")
        except Exception:
            pass

    if update_fields:
        checkout.save(update_fields=update_fields)
        logger.info(
            "Updated checkout %s email/user before completion: %s",
            checkout.token,
            normalized_email,
        )


def _send_order_confirmation_if_needed(order, manager, redirect_url: str = ""):
    from ..checkout.fetch import OrderInfo
    from ..order.notifications import send_order_confirmation

    customer_email = order.get_customer_email()
    if not customer_email:
        logger.warning(
            "Order %s has no customer email, skipping confirmation email",
            order.id,
        )
        return

    if _confirmation_email_already_sent(order):
        logger.info(
            "Order confirmation email already sent for order %s",
            order.id,
        )
        return

    order_info = OrderInfo(
        order=order,
        customer_email=customer_email,
        channel=order.channel,
        payment=order.get_last_payment(),
        lines_data=[],
    )
    logger.info(
        "Sending order confirmation email to %s for order %s",
        customer_email,
        order.id,
    )
    send_order_confirmation(order_info, redirect_url, manager)


@method_decorator(csrf_exempt, name='dispatch')
class CreateCheckoutWithoutStockCheckView(View):
    """
    Creates a checkout without stock availability validation.
    This is a workaround for cases where stock is configured incorrectly
    (e.g., warehouse not linked to channel shipping zone).
    """
    
    def options(self, request):
        """Handle CORS preflight requests"""
        response = JsonResponse({})
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response
    
    def post(self, request):
        logger.info(f'CreateCheckoutWithoutStockCheckView POST request received from {request.META.get("REMOTE_ADDR")}')
        logger.info(f'Request path: {request.path}')
        logger.info(f'Request method: {request.method}')
        logger.info(f'Content-Type: {request.META.get("CONTENT_TYPE")}')
        
        try:
            data = json.loads(request.body)
            logger.info(f'Request data: channel={data.get("channel")}, lines_count={len(data.get("lines", []))}')
            
            # Получаем данные из запроса
            channel_slug = data.get('channel', 'vspomni-site')
            lines = data.get('lines', [])
            email = data.get('email')
            
            if not lines:
                return JsonResponse(
                    {'error': 'Lines are required'}, 
                    status=400
                )
            
            # Получаем канал
            try:
                channel = Channel.objects.get(slug=channel_slug, is_active=True)
            except Channel.DoesNotExist:
                return JsonResponse(
                    {'error': f'Channel {channel_slug} not found'}, 
                    status=404
                )
            
            # Получаем варианты товаров
            variant_global_ids = []
            quantities = []
            for line in lines:
                variant_id = line.get('variantId')
                quantity = line.get('quantity', 1)
                
                if not variant_id:
                    return JsonResponse(
                        {'error': 'variantId is required for each line'}, 
                        status=400
                    )
                
                variant_global_ids.append(variant_id)
                quantities.append(quantity)
            
            # Конвертируем GraphQL IDs в database IDs
            variant_db_ids = []
            for global_id in variant_global_ids:
                try:
                    _, db_id = graphene.Node.from_global_id(global_id)
                    variant_db_ids.append(int(db_id))
                except Exception as e:
                    logger.error(f'Invalid variant ID: {global_id}', exc_info=e)
                    return JsonResponse(
                        {'error': f'Invalid variant ID: {global_id}'}, 
                        status=400
                    )
            
            # Получаем варианты из базы
            variants = product_models.ProductVariant.objects.filter(
                id__in=variant_db_ids
            ).select_related('product', 'product__product_type')
            
            if variants.count() != len(variant_db_ids):
                return JsonResponse(
                    {'error': 'Some variants not found'}, 
                    status=404
                )
            
            # Получаем channel listings для цен
            variant_listings = {
                listing.variant_id: listing
                for listing in product_models.ProductVariantChannelListing.objects.filter(
                    channel_id=channel.id,
                    variant_id__in=variant_db_ids
                )
            }
            
            # Проверяем, что все варианты доступны в канале
            variant_map = {v.id: v for v in variants}
            for variant_db_id in variant_db_ids:
                variant = variant_map.get(variant_db_id)
                if not variant:
                    return JsonResponse(
                        {'error': f'Variant {variant_db_id} not found'}, 
                        status=404
                    )
                
                variant_listing = variant_listings.get(variant_db_id)
                if not variant_listing:
                    return JsonResponse(
                        {'error': f'Variant {variant_db_id} not available in channel'}, 
                        status=400
                    )
            
            logger.info(f'Starting checkout creation: {len(variant_db_ids)} variants')
            
            # Пытаемся найти пользователя по email для связывания checkout
            user = None
            if email:
                from ..account.models import User
                try:
                    user = User.objects.filter(email=email.lower()).first()
                    if user:
                        logger.info(f'Found user for checkout: {user.email}')
                except Exception as e:
                    logger.warning(f'Error finding user by email: {e}')
            
            with transaction.atomic():
                # Создаем checkout без проверки наличия
                checkout = checkout_models.Checkout.objects.create(
                    channel=channel,
                    currency=channel.currency_code,
                    email=email,
                    user=user,  # Связываем с пользователем если найден
                )
                logger.info(f'Checkout created: {checkout.token}, user: {user.email if user else "None"}')
                
                # Создаем линии checkout напрямую, обходя проверку наличия
                checkout_lines = []
                
                for i, variant_db_id in enumerate(variant_db_ids):
                    variant = variant_map[variant_db_id]
                    variant_listing = variant_listings[variant_db_id]
                    
                    # Получаем цену варианта напрямую из listing
                    variant_price_amount = variant_listing.price_amount or Decimal('0')
                    variant_prior_price_amount = variant_listing.prior_price_amount
                    
                    # Создаем линию checkout
                    checkout_line = checkout_models.CheckoutLine(
                        checkout=checkout,
                        variant=variant,
                        quantity=quantities[i],
                        currency=channel.currency_code,
                        undiscounted_unit_price_amount=variant_price_amount,
                        prior_unit_price_amount=variant_prior_price_amount,
                    )
                    checkout_lines.append(checkout_line)
                
                # Массово создаем линии
                checkout_models.CheckoutLine.objects.bulk_create(checkout_lines)
                logger.info(f'Created {len(checkout_lines)} checkout lines')
            
            logger.info(f'Checkout creation completed: {checkout.token}')
            
            return JsonResponse({
                'success': True,
                'checkout': {
                    'id': str(checkout.token),
                    'token': str(checkout.token),
                }
            })
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error('Error creating checkout without stock check', exc_info=e)
            return JsonResponse(
                {'error': str(e)}, 
                status=500
            )


@method_decorator(csrf_exempt, name="dispatch")
class CompleteCheckoutWithoutStockCheckView(View):
    """
    Completes a checkout without stock availability validation.
    This is a workaround for cases where stock is configured incorrectly
    but payment has already been processed.
    """
    
    def options(self, request):
        """Handle CORS preflight requests"""
        response = JsonResponse({})
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response
    
    def post(self, request):
        logger.info(f'CompleteCheckoutWithoutStockCheckView POST request received from {request.META.get("REMOTE_ADDR")}')
        
        try:
            data = json.loads(request.body)
            checkout_token = data.get('checkoutId') or data.get('checkout_token')
            user_email = data.get('userEmail') or data.get('email')
            
            if not checkout_token:
                return JsonResponse(
                    {'error': 'checkoutId is required'}, 
                    status=400
                )
            
            # Обёртываем всё в транзакцию для использования select_for_update
            with transaction.atomic():
                # Сначала проверяем, не был ли checkout уже завершён (есть ли order с таким checkout_token)
                from ..order.models import Order
                existing_order = Order.objects.filter(checkout_token=checkout_token).first()
                if existing_order:
                    logger.info(
                        'Checkout %s already completed, returning existing order %s',
                        checkout_token,
                        existing_order.id,
                    )
                    redirect_url = existing_order.redirect_url or ''
                    from ..plugins.manager import get_plugins_manager
                    plugin_manager = get_plugins_manager(allow_replica=False)
                    transaction.on_commit(
                        lambda order=existing_order, mgr=plugin_manager, url=redirect_url: (
                            _send_order_confirmation_if_needed(order, mgr, url)
                        )
                    )

                    try:
                        stale_checkout = checkout_models.Checkout.objects.filter(
                            token=checkout_token
                        ).first()
                        if stale_checkout:
                            stale_checkout.delete()
                            logger.info(
                                'Deleted checkout %s after finding existing order',
                                checkout_token,
                            )
                    except Exception as e:
                        logger.warning(
                            'Failed to delete checkout %s: %s',
                            checkout_token,
                            e,
                        )
                    
                    return JsonResponse({
                        'success': True,
                        'order': {
                            'id': str(existing_order.id),
                            'number': existing_order.number or str(existing_order.id),
                            'status': existing_order.status,
                        }
                    })
                
                # Получаем checkout с блокировкой
                try:
                    checkout = checkout_models.Checkout.objects.select_for_update().get(token=checkout_token)
                except checkout_models.Checkout.DoesNotExist:
                    return JsonResponse(
                        {'error': 'Checkout not found'}, 
                        status=404
                    )

                _ensure_checkout_email(checkout, user_email)
                checkout.refresh_from_db()
                
                # Импортируем необходимые функции для создания order
                from ..checkout.complete_checkout import complete_checkout
                from ..plugins.manager import get_plugins_manager
                from ..core.exceptions import InsufficientStock
                from ..warehouse.models import Stock
                
                manager = get_plugins_manager(allow_replica=False)
                checkout_lines, _ = fetch_checkout_lines(checkout)
                checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)

                # ВАЖНО: для кастомного завершения checkout мы намеренно убираем ваучер/скидки,
                # чтобы обойти ограничения типа "Cannot add more than 1 times this item".
                # Скидка уже была учтена при внешнем платеже (YooKassa), поэтому здесь
                # приоритет – успешное создание заказа, даже если в Saleor он будет без ваучера.
                if checkout.voucher_code or checkout.discount_amount:
                    logger.info(
                        "Removing voucher/discount from checkout %s before completion. "
                        "voucher_code=%s, discount_amount=%s",
                        checkout_token,
                        checkout.voucher_code,
                        checkout.discount_amount,
                    )
                    checkout.voucher_code = None
                    checkout.discount_amount = Decimal("0")
                    checkout.discount_name = ""
                    checkout.save(
                        update_fields=["voucher_code", "discount_amount", "discount_name"]
                    )
                    # Переинициализируем данные после изменения
                    checkout_lines, _ = fetch_checkout_lines(checkout)
                    checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)
                
                # Убеждаемся, что shipping address установлен, если его нет
                # Это может предотвратить бесконечные циклы в админке
                if not checkout.shipping_address and checkout.billing_address:
                    # Используем billing address как shipping address если shipping не установлен
                    checkout.shipping_address = checkout.billing_address
                    checkout.save(update_fields=['shipping_address'])
                    logger.info(f'Set shipping address from billing address for checkout {checkout_token}')
                    # Обновляем checkout_info после изменения
                    checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)
                
                # Импортируем helper для выборочного отключения quantity-лимитов
                from ..warehouse.availability import set_disable_quantity_limits

                # ВРЕМЕННО отключаем track_inventory для всех вариантов в checkout, чтобы обойти проверку наличия
                # Это радикальное решение, которое гарантированно обходит проверку stock
                # Проверка наличия пропускается если variant.track_inventory = False
                variant_track_inventory_states = {}
                for line in checkout_lines:
                    variant = line.variant
                    if variant and variant.track_inventory:
                        variant_track_inventory_states[variant.id] = True
                        # Обновляем в БД напрямую для гарантии
                        from ..product.models import ProductVariant
                        ProductVariant.objects.filter(id=variant.id).update(track_inventory=False)
                        # Обновляем объект в памяти
                        variant.track_inventory = False
                        variant.refresh_from_db()
                        logger.info(f'Temporarily disabled track_inventory for variant {variant.id} (product: {variant.product.name if variant.product else "N/A"})')
                
                # Дополнительно отключаем глобальные quantity-лимиты только на время создания order
                set_disable_quantity_limits(True)

                try:
                    # Создаём order напрямую, обходя все проверки
                    # Используем email из checkout, если user не установлен
                    user = checkout.user
                    if not user and checkout.email:
                        # Пытаемся найти пользователя по email
                        from ..account.utils import retrieve_user_by_email
                        try:
                            user = retrieve_user_by_email(checkout.email)
                        except Exception:
                            user = None
                    
                    # Используем create_order_from_checkout с правильными параметрами
                    # Передаём checkout_info, а не checkout
                    from ..checkout.complete_checkout import create_order_from_checkout
                    
                    order = create_order_from_checkout(
                        checkout_info=checkout_info,
                        manager=manager,
                        user=user,
                        app=None,
                        metadata_list=None,
                        private_metadata_list=None,
                        delete_checkout=True,  # Удаляем checkout после создания order, чтобы избежать повторных попыток
                        is_automatic_completion=True,
                    )
                    
                    logger.info(f'Order created successfully: {order.id}, number: {order.number}')
                    
                    # Убеждаемся, что все transaction правильно связаны с order
                    # Это критично для предотвращения бесконечных циклов в админке
                    try:
                        from ..payment.models import TransactionItem
                        
                        # Обновляем все transaction для checkout, связывая их с order
                        checkout_transactions = TransactionItem.objects.filter(checkout_id=checkout.pk)
                        if checkout_transactions.exists():
                            transaction_count = checkout_transactions.count()
                            logger.info(f'Found {transaction_count} transactions for checkout, updating them to order {order.id}')
                            
                            # Проверяем и исправляем неправильные суммы transaction
                            order_total_cents = int(order.total_gross_amount * 100)  # Сумма заказа в копейках
                            for trans in checkout_transactions:
                                # Проверяем, не слишком ли большая сумма в transaction
                                if trans.charged_amount and trans.charged_amount.amount > 1000000:
                                    logger.warning(f'Transaction {trans.id} has suspiciously large amount: {trans.charged_amount.amount} cents. Order total: {order_total_cents} cents')
                                    # Исправляем сумму transaction на правильную
                                    if trans.charged_amount.amount > order_total_cents * 10:
                                        # Если сумма в 10+ раз больше, это явно ошибка
                                        logger.error(f'Transaction {trans.id} amount is {trans.charged_amount.amount} but order total is {order_total_cents}. This will cause issues in admin!')
                                        # Обновляем сумму transaction на правильную
                                        trans.charged_amount.amount = Decimal(order_total_cents)
                                        trans.save(update_fields=['charged_amount'])
                                        logger.info(f'Fixed transaction {trans.id} amount to {order_total_cents} cents')
                            
                            checkout_transactions.update(checkout_id=None, order=order)
                            logger.info(f'Updated {transaction_count} transactions to link with order {order.id}')
                        
                        # Убеждаемся, что checkout удалён после создания order
                        checkout.refresh_from_db()
                        if checkout.pk:  # Если checkout ещё существует
                            logger.warning(f'Checkout {checkout_token} still exists after order creation, deleting it')
                            checkout.delete()
                            logger.info(f'Deleted checkout {checkout_token} after order creation')
                    except Exception as cleanup_error:
                        logger.warning(f'Error during cleanup after order creation: {cleanup_error}', exc_info=True)
                    
                except Exception as e:
                    logger.error(f'Error creating order: {e}', exc_info=True)
                    error_msg = str(e)
                    
                    # Специальный обход ошибки "Cannot add more than 1 times this item"
                    # которая связана с ограничениями ваучера/промоакции на количество.
                    if "Cannot add more than 1 times this item" in error_msg:
                        logger.warning(
                            'Detected quantity limit error when creating order. '
                            'Retrying order creation after removing voucher/discounts.'
                        )
                        try:
                            # Очищаем ваучер и скидки на checkout, чтобы убрать ограничение
                            checkout.refresh_from_db()
                            checkout.discount_amount = Decimal("0")
                            checkout.discount_name = ""
                            checkout.voucher_code = None
                            checkout.save(
                                update_fields=["discount_amount", "discount_name", "voucher_code"]
                            )
                            
                            # Переинициализируем checkout_info после изменений
                            checkout_lines, _ = fetch_checkout_lines(checkout)
                            checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)
                            
                            # Повторная попытка создания заказа уже без ваучера
                            order = create_order_from_checkout(
                                checkout_info=checkout_info,
                                manager=manager,
                                user=user,
                                app=None,
                                metadata_list=None,
                                private_metadata_list=None,
                                delete_checkout=True,
                                is_automatic_completion=True,
                            )
                            
                            logger.info(
                                'Order created successfully on retry without voucher: %s',
                                order.id,
                            )
                        except Exception as retry_error:
                            logger.error(
                                'Retry order creation without voucher failed: %s',
                                retry_error,
                                exc_info=True,
                            )
                            # Пробрасываем исходную ошибку, чтобы REST вернул её наверх
                            raise e
                    else:
                        # Для всех остальных ошибок пробрасываем как есть
                        raise
                finally:
                    # Возвращаем поведение quantity-лимитов к стандартному
                    try:
                        set_disable_quantity_limits(False)
                    except Exception:
                        pass

                    # Восстанавливаем track_inventory для всех вариантов
                    for line in checkout_lines:
                        variant = line.variant
                        if variant and variant.id in variant_track_inventory_states:
                            original_value = variant_track_inventory_states[variant.id]
                            # Восстанавливаем в БД
                            from ..product.models import ProductVariant
                            ProductVariant.objects.filter(id=variant.id).update(track_inventory=original_value)
                            # Обновляем объект в памяти
                            variant.track_inventory = original_value
                            variant.refresh_from_db()
                            logger.info(f'Restored track_inventory={original_value} for variant {variant.id}')
                
                logger.info(f'Order created from checkout {checkout_token}: {order.number if order else "None"}')
                
                return JsonResponse({
                    'success': True,
                    'order': {
                        'id': str(order.id),
                        'number': order.number or str(order.id),
                        'status': order.status,
                    }
                })
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error('Error completing checkout without stock check', exc_info=e)
            return JsonResponse(
                {'error': str(e)}, 
                status=500
            )


@method_decorator(csrf_exempt, name="dispatch")
class ValidateVoucherView(View):
    """Валидация и применение ваучера через Saleor с применением всех правил."""

    def post(self, request):
        try:
            data = json.loads(request.body)
            promo_code = (data.get("promoCode") or "").strip()
            variant_ids = data.get("variantIds", [])  # Список ID вариантов товаров
            quantities = data.get("quantities", [])  # Список количеств
            channel_slug = data.get("channel", "vspomni-site")

            if not promo_code:
                return JsonResponse(
                    {"ok": False, "error": "Код промокода обязателен для заполнения"},
                    status=400,
                )

            if not variant_ids or len(variant_ids) != len(quantities):
                return JsonResponse(
                    {"ok": False, "error": "Неверный формат товаров"},
                    status=400,
                )

            # Получаем канал
            channel = Channel.objects.filter(slug=channel_slug).first()
            if not channel:
                return JsonResponse(
                    {"ok": False, "error": "Канал не найден"},
                    status=400,
                )

            # Создаем временный checkout для проверки ваучера
            manager = get_plugins_manager(allow_replica=False)
            checkout = checkout_models.Checkout.objects.create(
                channel=channel,
                currency=channel.currency_code,
            )

            # Получаем channel listings для цен
            # Добавляем товары в checkout
            lines = []
            variant_db_ids = []
            for variant_id, quantity in zip(variant_ids, quantities):
                try:
                    # Преобразуем global ID в database ID
                    try:
                        _, db_id = graphene.Node.from_global_id(variant_id)
                        variant_db_id = int(db_id)
                    except:
                        # Если это уже database ID
                        variant_db_id = int(variant_id) if variant_id.isdigit() else None
                        if not variant_db_id:
                            continue
                    
                    variant_db_ids.append(variant_db_id)
                except Exception as e:
                    print(f"Error parsing variant ID {variant_id}: {e}")
                    continue
            
            # Получаем варианты и их channel listings
            variants = product_models.ProductVariant.objects.filter(id__in=variant_db_ids).select_related('product')
            variant_listings = {
                listing.variant_id: listing
                for listing in product_models.ProductVariantChannelListing.objects.filter(
                    channel_id=channel.id,
                    variant_id__in=variant_db_ids
                )
            }
            
            for variant_id, quantity in zip(variant_ids, quantities):
                try:
                    try:
                        _, db_id = graphene.Node.from_global_id(variant_id)
                        variant_db_id = int(db_id)
                    except:
                        variant_db_id = int(variant_id) if variant_id.isdigit() else None
                        if not variant_db_id:
                            continue
                    
                    variant = variants.filter(id=variant_db_id).first()
                    variant_listing = variant_listings.get(variant_db_id)
                    
                    if variant and variant_listing:
                        # Получаем цены из channel listing
                        variant_price_amount = variant_listing.price_amount or Decimal('0')
                        variant_prior_price_amount = variant_listing.prior_price_amount
                        
                        checkout_line = checkout_models.CheckoutLine.objects.create(
                            checkout=checkout,
                            variant=variant,
                            quantity=quantity,
                            currency=channel.currency_code,
                            undiscounted_unit_price_amount=variant_price_amount,
                            prior_unit_price_amount=variant_prior_price_amount,
                        )
                        lines.append(checkout_line)
                except Exception as e:
                    print(f"Error adding variant {variant_id}: {e}")
                    continue

            if not lines:
                checkout.delete()
                return JsonResponse(
                    {"ok": False, "error": "Не удалось добавить товары в корзину"},
                    status=400,
                )

            # Получаем checkout_info и lines для применения ваучера
            checkout_lines, _ = fetch_checkout_lines(checkout)
            checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)

            # Пытаемся применить ваучер
            # Сначала проверяем, существует ли код ваучера
            from ..discount.models import VoucherCode, Voucher
            from django.utils import timezone
            
            # Пробуем найти код ваучера (с учетом и без учета регистра)
            voucher_code_obj = None
            codes_to_try = [
                promo_code,
                promo_code.upper(),
                promo_code.lower(),
                promo_code.strip(),
            ]
            
            for code_variant in codes_to_try:
                voucher_code_obj = VoucherCode.objects.filter(
                    code=code_variant,
                    is_active=True
                ).first()
                if voucher_code_obj:
                    # Если нашли код, используем его для применения
                    promo_code = voucher_code_obj.code
                    break
            
            if not voucher_code_obj:
                checkout.delete()
                return JsonResponse(
                    {"ok": False, "error": f"Ваучер с кодом '{promo_code}' не найден"},
                    status=400,
                )
            
            # Проверяем, что ваучер активен в канале
            voucher = voucher_code_obj.voucher
            if not Voucher.objects.active_in_channel(
                date=timezone.now(),
                channel_slug=channel_slug
            ).filter(id=voucher.id).exists():
                checkout.delete()
                return JsonResponse(
                    {"ok": False, "error": "Ваучер не активен в данном канале или истек"},
                    status=400,
                )
            
            try:
                add_promo_code_to_checkout(
                    manager,
                    checkout_info,
                    checkout_lines,
                    promo_code,  # Используем найденный код
                )
                checkout.refresh_from_db()

                # Вычисляем скидку
                discount_amount = float(checkout.discount_amount or Decimal('0'))
                subtotal = float(checkout.subtotal.gross.amount)
                
                # Получаем информацию о ваучере для определения типа скидки
                # voucher_code_obj уже найден выше
                discount_type = "FIXED"
                discount_percent = 0
                
                if voucher_code_obj:
                    voucher = voucher_code_obj.voucher
                    channel_listing = voucher.channel_listings.filter(channel=channel).first()
                    
                    if voucher.discount_value_type == "PERCENTAGE":
                        discount_type = "PERCENTAGE"
                        discount_percent = float(channel_listing.discount_value or 0) if channel_listing else 0
                    else:
                        # FIXED - фиксированная сумма
                        discount_type = "FIXED"
                        discount_percent = 0
                        
                        # Для фиксированной скидки вычисляем процент от суммы для отображения
                        if subtotal > 0 and discount_amount > 0:
                            discount_percent = round((discount_amount / subtotal) * 100, 2)
                
                # Удаляем временный checkout
                checkout.delete()

                return JsonResponse({
                    "ok": True,
                    "code": promo_code,
                    "discountAmount": discount_amount,
                    "discountType": discount_type,
                    "discountPercent": discount_percent,
                    "discountName": checkout.discount_name or "",
                })
            except InvalidPromoCode:
                # Удаляем временный checkout при ошибке
                checkout.delete()
                return JsonResponse(
                    {"ok": False, "error": "Ваучер не найден или недействителен"},
                    status=400,
                )
            except Exception as voucher_error:
                # Удаляем временный checkout при ошибке
                checkout.delete()
                error_msg = str(voucher_error)
                
                # Переводим стандартные ошибки на русский
                if "not found" in error_msg.lower() or "does not exist" in error_msg.lower() or "Invalid" in error_msg:
                    error_msg = "Ваучер не найден"
                elif "not applicable" in error_msg.lower() or "not valid" in error_msg.lower():
                    error_msg = "Ваучер не применим к данным товарам"
                elif "expired" in error_msg.lower():
                    error_msg = "Ваучер истек"
                elif "used" in error_msg.lower():
                    error_msg = "Ваучер уже использован"
                
                return JsonResponse(
                    {"ok": False, "error": error_msg},
                    status=400,
                )

        except json.JSONDecodeError:
            return JsonResponse(
                {"ok": False, "error": "Неверный формат JSON"},
                status=400,
            )
        except Exception as e:
            return JsonResponse(
                {"ok": False, "error": f"Ошибка сервера: {str(e)}"},
                status=500,
            )
