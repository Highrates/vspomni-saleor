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
            
            with transaction.atomic():
                # Создаем checkout без проверки наличия
                checkout = checkout_models.Checkout.objects.create(
                    channel=channel,
                    currency=channel.currency_code,
                    email=email,
                )
                logger.info(f'Checkout created: {checkout.token}')
                
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
            try:
                add_promo_code_to_checkout(
                    manager,
                    checkout_info,
                    checkout_lines,
                    promo_code,
                )
                checkout.refresh_from_db()

                # Вычисляем скидку
                discount_amount = float(checkout.discount_amount or Decimal('0'))
                subtotal = float(checkout.subtotal.gross.amount)
                
                # Получаем информацию о ваучере для определения типа скидки
                from ..discount.models import VoucherCode, Voucher
                voucher_code_obj = VoucherCode.objects.filter(code=promo_code, is_active=True).first()
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
