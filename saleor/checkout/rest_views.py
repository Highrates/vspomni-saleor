"""
Custom REST API views for checkout creation without stock validation.
This bypasses the standard checkout creation flow to avoid stock availability issues.
"""
import json
import logging
import os
import graphene
from decimal import Decimal
from django.utils import timezone

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
from ..core.exceptions import InsufficientStock, PermissionDenied
from ..core.utils.promo_code import InvalidPromoCode
from ..checkout import models as checkout_models
from ..channel.models import Channel
from ..discount import DiscountValueType, VoucherType
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
    from ..order.fetch import fetch_order_info
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

    order_info = fetch_order_info(order)
    logger.info(
        "Sending order confirmation email to %s for order %s",
        customer_email,
        order.id,
    )
    send_order_confirmation(order_info, redirect_url, manager)


def _safe_send_order_confirmation(order, manager, redirect_url: str = "") -> None:
    try:
        _send_order_confirmation_if_needed(order, manager, redirect_url)
    except Exception as email_error:
        logger.error(
            "Failed to send order confirmation for order %s: %s",
            order.id,
            email_error,
            exc_info=True,
        )


def _serialize_insufficient_stock_items(stock_error) -> list[dict]:
    items = []
    for item in stock_error.items:
        variant = item.variant
        product_name = ""
        variant_id = ""
        requested = None
        if variant:
            variant_id = str(variant.id)
            product_name = getattr(getattr(variant, "product", None), "name", "") or str(
                variant
            )
        if item.checkout_line:
            requested = item.checkout_line.quantity
        items.append(
            {
                "variantId": variant_id,
                "productName": product_name,
                "requested": requested,
                "available": item.available_quantity,
            }
        )
    return items


def _run_checkout_stock_check(checkout_info, checkout_lines) -> None:
    from ..warehouse.availability import check_stock_and_preorder_quantity_bulk

    variants = [line_info.variant for line_info in checkout_lines]
    quantities = [line_info.line.quantity for line_info in checkout_lines]
    country_code = checkout_info.get_country()
    additional_warehouse_lookup = (
        checkout_info.get_delivery_method_info().get_warehouse_filter_lookup()
    )
    check_stock_and_preorder_quantity_bulk(
        variants,
        country_code,
        quantities,
        checkout_info.channel.slug,
        global_quantity_limit=None,
        delivery_method_info=checkout_info.get_delivery_method_info(),
        additional_filter_lookup=additional_warehouse_lookup,
        existing_lines=checkout_lines,
        replace=True,
        check_reservations=True,
    )


def _get_ops_alert_email() -> str | None:
    return (
        os.environ.get("OPS_ALERT_EMAIL", "").strip()
        or os.environ.get("ORDER_ALERT_EMAIL", "").strip()
        or None
    )


def _mark_checkout_paid_stock_failure(
    checkout,
    *,
    payment_id: str | None,
    payment_amount,
    message: str,
) -> None:
    metadata_storage, _ = checkout_models.CheckoutMetadata.objects.get_or_create(
        checkout=checkout
    )
    metadata_storage.store_value_in_private_metadata(
        {
            "vsp_paid_stock_failure": "true",
            "vsp_paid_stock_failure_at": timezone.now().isoformat(),
            "vsp_paid_stock_payment_id": payment_id or "",
            "vsp_paid_stock_payment_amount": str(payment_amount or ""),
            "vsp_paid_stock_message": message[:500],
        }
    )
    metadata_storage.save(update_fields=["private_metadata"])


def _notify_ops_paid_stock_failure(
    *,
    checkout_token: str,
    payment_id: str | None,
    payment_amount,
    user_email: str | None,
    message: str,
    items: list[dict],
) -> None:
    recipient = _get_ops_alert_email()
    if not recipient:
        logger.warning(
            "Paid stock failure for checkout %s but OPS_ALERT_EMAIL is not set",
            checkout_token,
        )
        return

    from ..account.rest_views import _send_site_email

    lines = [
        f"Checkout: {checkout_token}",
        f"Payment ID: {payment_id or '—'}",
        f"Amount: {payment_amount or '—'}",
        f"Customer: {user_email or '—'}",
        f"Error: {message}",
        "",
        "Items:",
    ]
    for item in items:
        lines.append(
            " - {name} (variant {variant}): requested {requested}, available {available}".format(
                name=item.get("productName") or "?",
                variant=item.get("variantId") or "?",
                requested=item.get("requested"),
                available=item.get("available"),
            )
        )
    lines.extend(
        [
            "",
            "Action: refund via YooKassa or manually complete order after restocking.",
        ]
    )
    body = "\n".join(lines)
    try:
        _send_site_email(
            subject=f"[Vspomni] Paid checkout stock failure ({checkout_token[:8]})",
            message=body,
            recipient=recipient,
        )
        logger.info(
            "Sent paid stock failure alert for checkout %s to %s",
            checkout_token,
            recipient,
        )
    except Exception as email_error:
        logger.error(
            "Failed to send paid stock failure alert for checkout %s: %s",
            checkout_token,
            email_error,
            exc_info=True,
        )


def _insufficient_stock_json_response(
    data: dict,
    stock_error,
    *,
    requires_refund: bool = False,
) -> JsonResponse:
    items = _serialize_insufficient_stock_items(stock_error)
    checkout_token = data.get("checkoutId") or data.get("checkout_token")
    payment_id = data.get("paymentId") or data.get("payment_id")
    payment_amount = data.get("paymentAmount") or data.get("payment_amount")
    user_email = data.get("userEmail") or data.get("email")

    if requires_refund and checkout_token and payment_id:
        _notify_ops_paid_stock_failure(
            checkout_token=checkout_token,
            payment_id=payment_id,
            payment_amount=payment_amount,
            user_email=user_email,
            message=str(stock_error),
            items=items,
        )
        try:
            with transaction.atomic():
                checkout = checkout_models.Checkout.objects.select_for_update().get(
                    token=checkout_token
                )
                _mark_checkout_paid_stock_failure(
                    checkout,
                    payment_id=payment_id,
                    payment_amount=payment_amount,
                    message=str(stock_error),
                )
        except checkout_models.Checkout.DoesNotExist:
            logger.warning(
                "Checkout %s not found when marking paid stock failure",
                checkout_token,
            )
        except Exception as mark_error:
            logger.warning(
                "Failed to mark paid stock failure on checkout %s: %s",
                checkout_token,
                mark_error,
                exc_info=True,
            )

    return JsonResponse(
        {
            "error": "Insufficient stock for one or more items",
            "code": "INSUFFICIENT_STOCK",
            "message": str(stock_error),
            "items": items,
            "requiresRefund": bool(requires_refund and payment_id),
        },
        status=409,
    )


class PaidCheckoutCompleteError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        expected_total: float | None = None,
        paid_amount: float | None = None,
    ):
        self.code = code
        self.message = message
        self.expected_total = expected_total
        self.paid_amount = paid_amount
        super().__init__(message)


def _is_quantity_limit_error(exc: Exception) -> bool:
    msg = str(exc)
    return "Cannot add more than" in msg and "times this item" in msg


def _checkout_expected_payment_total(checkout_info) -> Decimal:
    checkout = checkout_info.checkout
    expected = Decimal(str(checkout.total.gross.amount))
    shipping_stored = Decimal(str(checkout.undiscounted_base_shipping_price_amount or 0))
    shipping_in_total = Decimal(
        str(checkout.shipping_price.gross.amount if checkout.shipping_price else 0)
    )

    if (
        checkout.external_shipping_method_id
        and shipping_stored > 0
        and shipping_in_total <= 0
    ):
        # Subtotal already includes order and product voucher discounts.
        subtotal = Decimal(str(checkout.subtotal.gross.amount))
        shipping = shipping_stored
        voucher = checkout_info.voucher
        if voucher and voucher.type == VoucherType.SHIPPING and checkout.discount:
            shipping = max(Decimal(0), shipping - Decimal(str(checkout.discount.amount)))
        expected = subtotal + shipping

    return expected


def _verify_payment_matches_checkout_total(checkout_info, payment_amount) -> None:
    if payment_amount is None:
        return

    expected = _checkout_expected_payment_total(checkout_info)
    paid = Decimal(str(payment_amount))
    if abs(expected - paid) > Decimal("0.01"):
        raise PaidCheckoutCompleteError(
            "PAYMENT_AMOUNT_MISMATCH",
            f"Payment amount {paid} does not match checkout total {expected}",
            expected_total=float(expected),
            paid_amount=float(paid),
        )


def _notify_ops_paid_complete_failure(
    *,
    checkout_token: str,
    payment_id: str | None,
    payment_amount,
    user_email: str | None,
    code: str,
    message: str,
) -> None:
    recipient = _get_ops_alert_email()
    if not recipient:
        return

    from ..account.rest_views import _send_site_email

    body = "\n".join(
        [
            f"Checkout: {checkout_token}",
            f"Payment ID: {payment_id or '—'}",
            f"Amount: {payment_amount or '—'}",
            f"Customer: {user_email or '—'}",
            f"Code: {code}",
            f"Error: {message}",
        ]
    )
    try:
        _send_site_email(
            subject=f"[Vspomni] Paid checkout failure ({code})",
            message=body,
            recipient=recipient,
        )
    except Exception as email_error:
        logger.error(
            "Failed to send paid complete failure alert for checkout %s: %s",
            checkout_token,
            email_error,
            exc_info=True,
        )


def _paid_complete_failure_json_response(
    data: dict,
    error: PaidCheckoutCompleteError,
) -> JsonResponse:
    checkout_token = data.get("checkoutId") or data.get("checkout_token")
    payment_id = data.get("paymentId") or data.get("payment_id")
    payment_amount = data.get("paymentAmount") or data.get("payment_amount")
    user_email = data.get("userEmail") or data.get("email")
    requires_refund = bool(payment_id)

    if requires_refund and checkout_token:
        _notify_ops_paid_complete_failure(
            checkout_token=checkout_token,
            payment_id=payment_id,
            payment_amount=payment_amount,
            user_email=user_email,
            code=error.code,
            message=error.message,
        )
        try:
            with transaction.atomic():
                checkout = checkout_models.Checkout.objects.select_for_update().get(
                    token=checkout_token
                )
                _mark_checkout_paid_stock_failure(
                    checkout,
                    payment_id=payment_id,
                    payment_amount=payment_amount,
                    message=f"{error.code}: {error.message}"[:500],
                )
        except Exception:
            pass

    payload = {
        "error": error.message,
        "code": error.code,
        "message": error.message,
        "requiresRefund": requires_refund,
    }
    if error.expected_total is not None:
        payload["expectedTotal"] = error.expected_total
    if error.paid_amount is not None:
        payload["paidAmount"] = error.paid_amount

    return JsonResponse(payload, status=409)


def _parse_allow_free_shipping(data: dict) -> bool:
    raw = data.get("allowFreeShipping")
    if raw is None:
        raw = data.get("allow_free_shipping")
    return str(raw).lower() in {"1", "true", "yes"}


def _validate_shipping_amount_for_carrier(
    shipping_carrier,
    shipping_amount,
    *,
    allow_free_shipping: bool,
) -> str | None:
    carrier = (shipping_carrier or "").strip().lower()
    amount = Decimal(str(shipping_amount or 0))
    if not carrier:
        return None
    if amount <= 0 and not allow_free_shipping:
        return (
            "Shipping amount must be positive when a carrier is selected "
            "(or set allowFreeShipping=true for free shipping)"
        )
    return None


CARRIER_SHIPPING_NAMES = {
    "cdek": "CDEK",
    "yandex": "Яндекс Доставка",
    "ozon": "Ozon",
}


def _external_shipping_graphql_id(carrier: str) -> str:
    """Saleor ожидает external shipping id в формате GraphQL app global id."""
    carrier = (carrier or "cdek").strip().lower()
    legacy = f"vspomni-external:{carrier}"
    return graphene.Node.to_global_id("app", f"0:{legacy}")


def _normalize_checkout_external_shipping_id(checkout) -> None:
    """Исправляет legacy id вида vspomni-external:cdek (ломает base64 decode)."""
    ext_id = checkout.external_shipping_method_id
    if not ext_id or not str(ext_id).startswith("vspomni-external:"):
        return
    checkout.external_shipping_method_id = graphene.Node.to_global_id(
        "app", f"0:{ext_id}"
    )
    checkout.save(update_fields=["external_shipping_method_id"])
    logger.info(
        "Normalized legacy external_shipping_method_id on checkout %s",
        checkout.token,
    )


def _fix_transaction_available_actions(transaction) -> None:
    """GraphQL ожидает lowercase: charge/refund, не CHARGE/REFUND."""
    from ..payment import TransactionAction

    mapping = {
        "CHARGE": TransactionAction.CHARGE,
        "REFUND": TransactionAction.REFUND,
        "CANCEL": TransactionAction.CANCEL,
        "CAPTURE": TransactionAction.CHARGE,
        "VOID": TransactionAction.CANCEL,
    }
    actions = list(transaction.available_actions or [])
    if not actions:
        return
    fixed = []
    changed = False
    for action in actions:
        normalized = mapping.get(str(action).upper(), str(action).lower())
        if normalized not in fixed:
            fixed.append(normalized)
        if normalized != action:
            changed = True
    if changed:
        transaction.available_actions = fixed
        transaction.save(update_fields=["available_actions"])
        logger.info(
            "Fixed transaction %s available_actions: %s -> %s",
            transaction.pk,
            actions,
            fixed,
        )


def _country_code_from_payload(address: dict) -> str:
    country = address.get("country")
    if isinstance(country, dict):
        return (country.get("code") or "RU").strip().upper() or "RU"
    if isinstance(country, str) and country.strip():
        return country.strip().upper()
    return "RU"


def _validate_address_payload(address: dict | None) -> str | None:
    """Return error message if address is missing required delivery fields."""
    if not address or not isinstance(address, dict):
        return "address is required"

    street = (
        address.get("streetAddress1") or address.get("street_address_1") or ""
    ).strip()
    city = (address.get("city") or "").strip()
    phone = (address.get("phone") or "").strip()
    postal = (
        address.get("postalCode") or address.get("postal_code") or ""
    ).strip()

    if not street:
        return "streetAddress1 is required"
    if not city:
        return "city is required"
    if not phone:
        return "phone is required"
    if not postal:
        return "postalCode is required"
    return None


def _create_address_from_payload(address: dict | None):
    """Create Saleor Address without GraphQL quantity/stock validation."""
    from ..account.models import Address

    error = _validate_address_payload(address)
    if error:
        raise ValueError(error)

    street = (
        address.get("streetAddress1") or address.get("street_address_1") or ""
    ).strip()
    city = (address.get("city") or "").strip()
    phone = (address.get("phone") or "").strip()
    postal = (
        address.get("postalCode") or address.get("postal_code") or ""
    ).strip()

    return Address.objects.create(
        first_name=(address.get("firstName") or address.get("first_name") or "Пользователь")[:256],
        last_name=(address.get("lastName") or address.get("last_name") or "")[:256],
        company_name=(address.get("companyName") or address.get("company_name") or "")[:256],
        street_address_1=street[:256],
        street_address_2=(
            address.get("streetAddress2") or address.get("street_address_2") or ""
        )[:256],
        city=city[:256],
        city_area=(address.get("cityArea") or address.get("city_area") or "")[:128],
        postal_code=postal[:20],
        country=_country_code_from_payload(address),
        country_area=(address.get("countryArea") or address.get("country_area") or "")[:128],
        phone=phone[:128],
        validation_skipped=True,
    )


def _assign_addresses_to_checkout(checkout, address_payload: dict | None):
    if not address_payload:
        return False

    error = _validate_address_payload(address_payload)
    if error:
        raise ValueError(error)

    billing = _create_address_from_payload(address_payload)
    shipping = _create_address_from_payload(address_payload)
    if not billing or not shipping:
        return False

    checkout.billing_address = billing
    checkout.shipping_address = shipping
    checkout.save(update_fields=["billing_address", "shipping_address"])
    logger.info("Set billing/shipping addresses on checkout %s via REST", checkout.token)
    return True


class PromoCodeNotApplied(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _format_rub(amount) -> str:
    value = Decimal(str(amount))
    if value == value.to_integral_value():
        return f"{int(value)}"
    return f"{value:.2f}"


def _promo_error_message(exc: Exception) -> str:
    from ..discount.models import NotApplicable

    if isinstance(exc, InvalidPromoCode):
        return "Промокод не найден или больше не действует"

    cause = exc if isinstance(exc, NotApplicable) else exc.__cause__
    if isinstance(cause, NotApplicable):
        if cause.min_spent is not None:
            return (
                "Промокод действует для заказов от "
                f"{_format_rub(cause.min_spent.amount)} ₽"
            )
        if cause.min_checkout_items_quantity:
            return (
                "Промокод действует при заказе от "
                f"{cause.min_checkout_items_quantity} шт."
            )
        msg = str(cause).lower()
        if "once per customer" in msg:
            return "Вы уже использовали этот промокод"
        if "staff" in msg:
            return "Промокод недоступен"
        if "selected items" in msg:
            return "Промокод не распространяется на товары в корзине"
        if "country" in msg:
            return "Промокод не действует в вашем регионе"
        if "delivery method" in msg:
            return "Промокод на доставку применится после расчёта доставки"
        if "not require shipping" in msg:
            return "Промокод на доставку не подходит для этого заказа"
        if "channel" in msg:
            return "Промокод не действует в этом магазине"
    return "Промокод не подходит для этого заказа"


def _resolve_voucher_code(promo_code: str):
    from ..discount.models import VoucherCode

    code = (promo_code or "").strip()
    if not code:
        return None
    return (
        VoucherCode.objects.filter(code=code).first()
        or VoucherCode.objects.filter(code__iexact=code).first()
    )


def _apply_promo_code_without_quantity_limits(checkout, promo_code: str | None):
    """Apply voucher bypassing quantity_limit_per_customer checks.

    Raise PromoCodeNotApplied when the code cannot be applied, so the caller never
    creates a full-price checkout while the customer expects a discount.
    """
    if not promo_code or not str(promo_code).strip():
        return None

    from ..checkout.calculations import fetch_checkout_data
    from ..checkout.utils import invalidate_checkout
    from ..warehouse.availability import set_disable_quantity_limits

    requested_code = str(promo_code).strip()
    voucher_code = _resolve_voucher_code(requested_code)
    code = voucher_code.code if voucher_code else requested_code

    manager = get_plugins_manager(allow_replica=False)
    lines, _ = fetch_checkout_lines(checkout)
    checkout_info = fetch_checkout_info(checkout, lines, manager)

    set_disable_quantity_limits(True)
    try:
        try:
            add_promo_code_to_checkout(manager, checkout_info, lines, code)
        except Exception as promo_error:
            raise PromoCodeNotApplied(
                requested_code, _promo_error_message(promo_error)
            ) from promo_error

        invalidate_fields = invalidate_checkout(
            checkout_info, lines, manager, recalculate_discount=False, save=False
        )
        if invalidate_fields:
            checkout.save(update_fields=invalidate_fields)
        checkout_info, lines = fetch_checkout_data(checkout_info, manager, lines)
        checkout.refresh_from_db()
        if not checkout.voucher_code:
            raise PromoCodeNotApplied(
                requested_code, "Промокод не подходит для этого заказа"
            )

        total = checkout.total.gross
        logger.info(
            "Applied promo %s on checkout %s without quantity limits, total=%s",
            code,
            checkout.token,
            total.amount,
        )
        return {
            "code": checkout.voucher_code,
            "total": float(total.amount),
            "currency": str(total.currency),
            "discount": float(checkout.discount_amount or 0),
        }
    finally:
        set_disable_quantity_limits(False)


def _build_external_shipping_method(shipping_amount, shipping_carrier, currency):
    from prices import Money

    from ..shipping.interface import ShippingMethodData

    carrier = (shipping_carrier or "cdek").strip().lower()
    name = CARRIER_SHIPPING_NAMES.get(carrier, "Доставка")
    method_id = _external_shipping_graphql_id(carrier)
    amount = Decimal(str(shipping_amount or 0))
    return ShippingMethodData(
        id=method_id,
        name=name,
        price=Money(amount, currency),
    )


def _apply_external_shipping_to_checkout(
    checkout,
    checkout_info,
    lines,
    manager,
    shipping_amount,
    shipping_carrier=None,
):
    from ..checkout.calculations import fetch_checkout_data
    from ..checkout.utils import assign_external_shipping_to_checkout, invalidate_checkout

    amount = Decimal(str(shipping_amount or 0))
    if amount <= 0:
        return checkout_info, lines

    shipping_data = _build_external_shipping_method(
        shipping_amount, shipping_carrier, checkout.currency
    )
    fields = assign_external_shipping_to_checkout(checkout, shipping_data)
    invalidate_fields = invalidate_checkout(checkout_info, lines, manager, save=False)
    update_fields = list(set(fields + invalidate_fields))
    if update_fields:
        checkout.save(update_fields=update_fields)

    return fetch_checkout_data(checkout_info, manager, lines)


def _align_order_with_external_shipping_payment(order, checkout, payment_amount):
    """Синхронизирует total/shipping заказа с REST-доставкой (CDEK/Yandex/Ozon)."""
    from ..order.utils import update_order_charge_status

    undiscounted_shipping = Decimal(
        str(checkout.undiscounted_base_shipping_price_amount or 0)
    )
    if not checkout.external_shipping_method_id or undiscounted_shipping <= 0:
        return order

    shipping_amount = undiscounted_shipping
    voucher = order.voucher
    if voucher and voucher.type == VoucherType.SHIPPING:
        from prices import Money

        discount = voucher.get_discount_amount_for(
            Money(undiscounted_shipping, order.currency), order.channel
        )
        shipping_amount = max(Decimal(0), undiscounted_shipping - discount.amount)

    subtotal = Decimal(str(order.subtotal_gross_amount or 0))
    expected_total = subtotal + shipping_amount
    current_total = Decimal(str(order.total_gross_amount or 0))

    if abs(current_total - expected_total) <= Decimal("0.01"):
        update_order_charge_status(order, Decimal("0"))
        order.save(update_fields=["charge_status"])
        return order

    order.shipping_price_gross_amount = shipping_amount
    order.shipping_price_net_amount = shipping_amount
    order.base_shipping_price_amount = shipping_amount
    order.undiscounted_base_shipping_price_amount = undiscounted_shipping
    order.total_gross_amount = expected_total
    order.total_net_amount = expected_total
    order.save(
        update_fields=[
            "shipping_price_gross_amount",
            "shipping_price_net_amount",
            "base_shipping_price_amount",
            "undiscounted_base_shipping_price_amount",
            "total_gross_amount",
            "total_net_amount",
        ]
    )
    update_order_charge_status(order, Decimal("0"))
    order.save(update_fields=["charge_status"])
    logger.info(
        "Aligned order %s totals: subtotal=%s shipping=%s total=%s payment=%s",
        order.number,
        subtotal,
        shipping_amount,
        expected_total,
        payment_amount,
    )
    return order


def _ensure_yookassa_transaction(checkout, user, payment_id, payment_amount, manager):
    from ..payment import TransactionAction
    from ..payment.models import TransactionItem
    from ..payment.utils import (
        create_manual_adjustment_events,
        get_transaction_item_params,
        process_order_or_checkout_with_transaction,
        recalculate_transaction_amounts,
    )

    amount = Decimal(str(payment_amount or 0))
    if amount <= 0:
        return None

    psp_ref = (payment_id or "").strip()
    name = f"YooKassa Payment {psp_ref}" if psp_ref else "YooKassa Payment"

    if psp_ref:
        existing = TransactionItem.objects.filter(
            checkout_id=checkout.pk,
            psp_reference=psp_ref,
        ).first()
        if existing:
            _fix_transaction_available_actions(existing)
            return existing

    existing_charged = TransactionItem.objects.filter(
        checkout_id=checkout.pk,
        charged_value__gte=amount,
    ).first()
    if existing_charged:
        _fix_transaction_available_actions(existing_charged)
        return existing_charged

    txn = TransactionItem.objects.create(
        **get_transaction_item_params(
            source_object=checkout,
            user=user,
            app=None,
            psp_reference=psp_ref or None,
            available_actions=[TransactionAction.CHARGE, TransactionAction.REFUND],
            name=name,
        )
    )
    create_manual_adjustment_events(
        transaction=txn,
        money_data={"charged_value": amount},
        user=user,
        app=None,
    )
    recalculate_transaction_amounts(transaction=txn)
    process_order_or_checkout_with_transaction(txn, manager, user, None)
    return txn


@method_decorator(csrf_exempt, name="dispatch")
class ApplyExternalShippingView(View):
    """Apply CDEK/Yandex/Ozon shipping price to checkout before payment."""

    def options(self, request):
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    def post(self, request):
        try:
            data = json.loads(request.body)
            checkout_token = data.get("checkoutId") or data.get("checkout_token")
            shipping_amount = data.get("shippingAmount") or data.get("shipping_amount")
            shipping_carrier = data.get("shippingCarrier") or data.get("shipping_carrier")
            allow_free_shipping = _parse_allow_free_shipping(data)

            if not checkout_token:
                return JsonResponse({"error": "checkoutId is required"}, status=400)

            shipping_error = _validate_shipping_amount_for_carrier(
                shipping_carrier,
                shipping_amount,
                allow_free_shipping=allow_free_shipping,
            )
            if shipping_error:
                return JsonResponse({"error": shipping_error}, status=400)

            amount = Decimal(str(shipping_amount or 0))
            if amount <= 0:
                try:
                    checkout = checkout_models.Checkout.objects.get(token=checkout_token)
                except checkout_models.Checkout.DoesNotExist:
                    return JsonResponse({"error": "Checkout not found"}, status=404)

                manager = get_plugins_manager(allow_replica=False)
                checkout_lines, _ = fetch_checkout_lines(checkout)
                checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)
                total = checkout_info.checkout.total.gross
                return JsonResponse(
                    {
                        "success": True,
                        "total": {
                            "amount": float(total.amount),
                            "currency": str(total.currency),
                        },
                        "shipping": {
                            "amount": 0.0,
                            "carrier": (shipping_carrier or "cdek"),
                            "free": True,
                        },
                    }
                )

            try:
                checkout = checkout_models.Checkout.objects.get(token=checkout_token)
            except checkout_models.Checkout.DoesNotExist:
                return JsonResponse({"error": "Checkout not found"}, status=404)

            manager = get_plugins_manager(allow_replica=False)
            checkout_lines, _ = fetch_checkout_lines(checkout)
            checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)
            checkout_info, checkout_lines = _apply_external_shipping_to_checkout(
                checkout,
                checkout_info,
                checkout_lines,
                manager,
                amount,
                shipping_carrier,
            )

            total = checkout_info.checkout.total.gross
            return JsonResponse(
                {
                    "success": True,
                    "total": {
                        "amount": float(total.amount),
                        "currency": str(total.currency),
                    },
                    "shipping": {
                        "amount": float(amount),
                        "carrier": (shipping_carrier or "cdek"),
                    },
                }
            )
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            logger.error("Error applying external shipping", exc_info=e)
            return JsonResponse({"error": str(e)}, status=500)


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
            if email:
                email = email.strip().lower()
            address_payload = data.get('address') or data.get('deliveryAddress')
            promo_code = data.get('promoCode') or data.get('promo_code')
            shipping_amount = data.get('shippingAmount') or data.get('shipping_amount')
            shipping_carrier = data.get('shippingCarrier') or data.get('shipping_carrier')
            
            if not lines:
                return JsonResponse(
                    {'error': 'Lines are required'}, 
                    status=400
                )

            if address_payload:
                address_error = _validate_address_payload(address_payload)
                if address_error:
                    return JsonResponse({'error': address_error}, status=400)
            
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
                promo_info = None
                
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

                if address_payload:
                    try:
                        _assign_addresses_to_checkout(checkout, address_payload)
                    except ValueError as addr_error:
                        return JsonResponse({'error': str(addr_error)}, status=400)
                    except Exception as addr_error:
                        logger.warning(
                            "Failed to set addresses on checkout %s: %s",
                            checkout.token,
                            addr_error,
                            exc_info=True,
                        )

                if promo_code:
                    # Shipping vouchers need the delivery method on the checkout.
                    if shipping_amount and Decimal(str(shipping_amount)) > 0:
                        shipping_manager = get_plugins_manager(allow_replica=False)
                        shipping_lines, _ = fetch_checkout_lines(checkout)
                        shipping_info = fetch_checkout_info(
                            checkout, shipping_lines, shipping_manager
                        )
                        _apply_external_shipping_to_checkout(
                            checkout,
                            shipping_info,
                            shipping_lines,
                            shipping_manager,
                            shipping_amount,
                            shipping_carrier,
                        )
                    try:
                        promo_info = _apply_promo_code_without_quantity_limits(
                            checkout, promo_code
                        )
                    except PromoCodeNotApplied as promo_error:
                        logger.warning(
                            "Promo %s rejected on checkout %s: %s",
                            promo_code,
                            checkout.token,
                            promo_error.__cause__ or promo_error.message,
                        )
                        transaction.set_rollback(True)
                        return JsonResponse(
                            {
                                'error': promo_error.message,
                                'code': 'PROMO_CODE_NOT_APPLIED',
                                'promoCode': promo_error.code,
                            },
                            status=400,
                        )
            
            logger.info(f'Checkout creation completed: {checkout.token}')

            response_payload = {
                'success': True,
                'checkout': {
                    'id': str(checkout.token),
                    'token': str(checkout.token),
                }
            }
            if promo_info:
                response_payload['promo'] = promo_info
                response_payload['total'] = {
                    'amount': promo_info['total'],
                    'currency': promo_info['currency'],
                }
            else:
                try:
                    manager = get_plugins_manager(allow_replica=False)
                    checkout_lines_info, _ = fetch_checkout_lines(checkout)
                    checkout_info = fetch_checkout_info(checkout, checkout_lines_info, manager)
                    from ..checkout.calculations import fetch_checkout_data
                    checkout_info, _ = fetch_checkout_data(
                        checkout_info, manager, checkout_lines_info
                    )
                    total = checkout_info.checkout.total.gross
                    response_payload['total'] = {
                        'amount': float(total.amount),
                        'currency': str(total.currency),
                    }
                except Exception:
                    pass
            
            return JsonResponse(response_payload)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error('Error creating checkout without stock check', exc_info=e)
            return JsonResponse(
                {'error': str(e)}, 
                status=500
            )


@method_decorator(csrf_exempt, name="dispatch")
class CheckCheckoutStockView(View):
    """Проверка наличия товара до создания платежа."""

    def options(self, request):
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    def post(self, request):
        try:
            data = json.loads(request.body)
            checkout_token = data.get("checkoutId") or data.get("checkout_token")

            if not checkout_token:
                return JsonResponse({"error": "checkoutId is required"}, status=400)

            try:
                checkout = checkout_models.Checkout.objects.get(token=checkout_token)
            except checkout_models.Checkout.DoesNotExist:
                return JsonResponse({"error": "Checkout not found"}, status=404)

            manager = get_plugins_manager(allow_replica=False)
            checkout_lines, _ = fetch_checkout_lines(checkout)
            checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)

            try:
                _run_checkout_stock_check(checkout_info, checkout_lines)
            except InsufficientStock as stock_error:
                return _insufficient_stock_json_response(data, stock_error)

            return JsonResponse({"available": True, "success": True})
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            logger.error("Error checking checkout stock", exc_info=e)
            return JsonResponse({"error": str(e)}, status=500)


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
            payment_id = data.get('paymentId') or data.get('payment_id')
            payment_amount = data.get('paymentAmount') or data.get('payment_amount')
            shipping_amount = data.get('shippingAmount') or data.get('shipping_amount')
            shipping_carrier = data.get('shippingCarrier') or data.get('shipping_carrier')
            allow_free_shipping = _parse_allow_free_shipping(data)
            address_payload = data.get('address') or data.get('deliveryAddress')
            
            if not checkout_token:
                return JsonResponse(
                    {'error': 'checkoutId is required'}, 
                    status=400
                )

            shipping_validation_error = _validate_shipping_amount_for_carrier(
                shipping_carrier,
                shipping_amount,
                allow_free_shipping=allow_free_shipping,
            )
            if shipping_validation_error:
                return JsonResponse({'error': shipping_validation_error}, status=400)
            
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
                    plugin_manager = get_plugins_manager(allow_replica=False)
                    transaction.on_commit(
                        lambda order=existing_order, mgr=plugin_manager, url=redirect_url: (
                            _safe_send_order_confirmation(order, mgr, url)
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
                
                if address_payload:
                    address_error = _validate_address_payload(address_payload)
                    if address_error:
                        return JsonResponse({'error': address_error}, status=400)

                # Получаем checkout с блокировкой
                try:
                    checkout = checkout_models.Checkout.objects.select_for_update().get(token=checkout_token)
                except checkout_models.Checkout.DoesNotExist:
                    return JsonResponse(
                        {'error': 'Checkout not found'}, 
                        status=404
                    )

                _normalize_checkout_external_shipping_id(checkout)

                _ensure_checkout_email(checkout, user_email)
                checkout.refresh_from_db()

                if address_payload:
                    try:
                        _assign_addresses_to_checkout(checkout, address_payload)
                        checkout.refresh_from_db()
                    except ValueError as addr_error:
                        return JsonResponse({'error': str(addr_error)}, status=400)
                    except Exception as addr_error:
                        logger.warning(
                            "Failed to set addresses before complete on %s: %s",
                            checkout_token,
                            addr_error,
                            exc_info=True,
                        )

                # Импортируем необходимые функции для создания order
                from ..checkout.complete_checkout import complete_checkout

                manager = get_plugins_manager(allow_replica=False)
                checkout_lines, _ = fetch_checkout_lines(checkout)
                checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)

                if checkout.voucher_code:
                    logger.info(
                        "Keeping voucher on checkout %s before completion: code=%s, discount=%s",
                        checkout_token,
                        checkout.voucher_code,
                        checkout.discount_amount,
                    )

                # Убеждаемся, что shipping address установлен, если его нет
                if not checkout.shipping_address and checkout.billing_address:
                    checkout.shipping_address = checkout.billing_address
                    checkout.save(update_fields=['shipping_address'])
                    logger.info(f'Set shipping address from billing address for checkout {checkout_token}')
                    checkout_info = fetch_checkout_info(checkout, checkout_lines, manager)

                if not checkout.shipping_address:
                    return JsonResponse(
                        {'error': 'Checkout shipping address is required'},
                        status=400,
                    )
                
                # Отключаем quantity-лимиты ваучеров только на время создания order
                from ..warehouse.availability import set_disable_quantity_limits

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

                    if shipping_amount and Decimal(str(shipping_amount)) > 0:
                        checkout_info, checkout_lines = _apply_external_shipping_to_checkout(
                            checkout,
                            checkout_info,
                            checkout_lines,
                            manager,
                            shipping_amount,
                            shipping_carrier,
                        )

                    if payment_amount:
                        _ensure_yookassa_transaction(
                            checkout,
                            user,
                            payment_id,
                            payment_amount,
                            manager,
                        )
                        from ..checkout.calculations import fetch_checkout_data

                        checkout_info, checkout_lines = fetch_checkout_data(
                            checkout_info, manager, checkout_lines
                        )

                    _verify_payment_matches_checkout_total(checkout_info, payment_amount)
                    
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

                    order = _align_order_with_external_shipping_payment(
                        order, checkout, payment_amount
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
                    
                except InsufficientStock as stock_error:
                    logger.error('Insufficient stock when creating order: %s', stock_error)
                    raise stock_error
                except PaidCheckoutCompleteError:
                    raise
                except Exception as e:
                    logger.error(f'Error creating order: {e}', exc_info=True)
                    if payment_id and _is_quantity_limit_error(e):
                        raise PaidCheckoutCompleteError(
                            "CHECKOUT_QUANTITY_LIMIT",
                            str(e),
                        ) from e
                    raise
                finally:
                    # Возвращаем поведение quantity-лимитов к стандартному
                    try:
                        set_disable_quantity_limits(False)
                    except Exception:
                        pass
                
                logger.info(f'Order created from checkout {checkout_token}: {order.number if order else "None"}')
                
                return JsonResponse({
                    'success': True,
                    'order': {
                        'id': str(order.id),
                        'number': order.number or str(order.id),
                        'status': order.status,
                    }
                })
            
        except InsufficientStock as stock_error:
            return _insufficient_stock_json_response(
                data,
                stock_error,
                requires_refund=bool(
                    (data.get("paymentId") or data.get("payment_id"))
                ),
            )
        except PaidCheckoutCompleteError as complete_error:
            return _paid_complete_failure_json_response(data, complete_error)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error('Error completing checkout without stock check', exc_info=e)
            return JsonResponse(
                {'error': str(e)}, 
                status=500
            )


VOUCHER_VALIDATE_WINDOW_SECONDS = 600
VOUCHER_VALIDATE_MAX_REQUESTS = 40
VOUCHER_VALIDATE_MAX_UNKNOWN_CODES = 10
VOUCHER_VALIDATE_MAX_LINES = 100


def _cache_incr(key: str, timeout: int) -> int:
    from django.core.cache import cache

    if cache.add(key, 1, timeout):
        return 1
    try:
        return cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout)
        return 1


def _parse_variant_db_id(variant_id) -> int | None:
    raw = str(variant_id or "").strip()
    if raw.isdigit():
        return int(raw)
    try:
        _, db_id = graphene.Node.from_global_id(raw)
        return int(db_id)
    except Exception:
        return None


def _voucher_scope(voucher) -> str:
    if voucher.type == VoucherType.SHIPPING:
        return "SHIPPING"
    if voucher.type == VoucherType.SPECIFIC_PRODUCT:
        return "PRODUCTS"
    if voucher.apply_once_per_order:
        return "CHEAPEST"
    return "ORDER"


@method_decorator(csrf_exempt, name="dispatch")
class ValidateVoucherView(View):
    """Проверка промокода по правилам Saleor на временном checkout.

    Все записи в БД откатываются; запросы ограничены по IP, неизвестные коды
    считаются отдельно, чтобы коды нельзя было перебирать.
    """

    def options(self, request):
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    def post(self, request):
        from django.core.cache import cache

        from ..core.utils import get_client_ip

        # X-Real-IP is set by nginx; the first X-Forwarded-For hop is client-controlled.
        client_ip = (
            request.META.get("HTTP_X_REAL_IP", "").strip()
            or get_client_ip(request)
            or "unknown"
        )
        requests_key = f"voucher-validate:requests:{client_ip}"
        unknown_key = f"voucher-validate:unknown:{client_ip}"
        too_many = JsonResponse(
            {
                "ok": False,
                "error": "Слишком много попыток. Попробуйте через несколько минут.",
            },
            status=429,
        )
        if (cache.get(unknown_key) or 0) >= VOUCHER_VALIDATE_MAX_UNKNOWN_CODES:
            return too_many
        if (
            _cache_incr(requests_key, VOUCHER_VALIDATE_WINDOW_SECONDS)
            > VOUCHER_VALIDATE_MAX_REQUESTS
        ):
            return too_many

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse(
                {"ok": False, "error": "Неверный формат запроса"}, status=400
            )

        try:
            with transaction.atomic():
                payload, status = self._validate(data)
                transaction.set_rollback(True)
        except Exception:
            logger.exception("Voucher validation failed")
            return JsonResponse(
                {
                    "ok": False,
                    "error": "Не удалось проверить промокод. Попробуйте позже.",
                },
                status=500,
            )

        if payload.pop("unknownCode", False):
            _cache_incr(unknown_key, VOUCHER_VALIDATE_WINDOW_SECONDS)
        return JsonResponse(payload, status=status)

    def _validate(self, data: dict) -> tuple[dict, int]:
        from ..account.models import User
        from ..checkout.utils import assign_external_shipping_to_checkout
        from ..discount.models import Voucher
        from ..discount.utils.voucher import validate_voucher_for_checkout
        from ..warehouse.availability import set_disable_quantity_limits

        promo_code = str(data.get("promoCode") or "").strip()[:255]
        variant_ids = data.get("variantIds") or []
        quantities = data.get("quantities") or []
        channel_slug = data.get("channel") or "vspomni-site"
        email = str(data.get("email") or "").strip().lower() or None
        shipping_amount = Decimal(str(data.get("shippingAmount") or 0))
        shipping_carrier = data.get("shippingCarrier")

        if not promo_code:
            return {"ok": False, "error": "Введите промокод"}, 400
        if (
            not isinstance(variant_ids, list)
            or not isinstance(quantities, list)
            or not variant_ids
            or len(variant_ids) != len(quantities)
            or len(variant_ids) > VOUCHER_VALIDATE_MAX_LINES
        ):
            return {"ok": False, "error": "Неверный формат товаров"}, 400

        channel = Channel.objects.filter(slug=channel_slug, is_active=True).first()
        if not channel:
            return {"ok": False, "error": "Магазин не найден"}, 400

        not_found = {
            "ok": False,
            "error": "Промокод не найден или больше не действует",
            "unknownCode": True,
        }
        voucher_code = _resolve_voucher_code(promo_code)
        if not voucher_code or not voucher_code.is_active:
            return not_found, 400
        voucher = voucher_code.voucher
        if (
            not Voucher.objects.active_in_channel(
                date=timezone.now(), channel_slug=channel.slug
            )
            .filter(id=voucher.id)
            .exists()
        ):
            return not_found, 400

        quantity_by_variant: dict[int, int] = {}
        for variant_id, quantity in zip(variant_ids, quantities):
            db_id = _parse_variant_db_id(variant_id)
            try:
                qty = int(quantity)
            except (TypeError, ValueError):
                qty = 0
            if db_id and qty > 0:
                quantity_by_variant[db_id] = (
                    quantity_by_variant.get(db_id, 0) + min(qty, 999)
                )

        variants = product_models.ProductVariant.objects.filter(
            id__in=quantity_by_variant.keys()
        )
        listings = {
            listing.variant_id: listing
            for listing in product_models.ProductVariantChannelListing.objects.filter(
                channel_id=channel.id, variant_id__in=quantity_by_variant.keys()
            )
        }

        user = User.objects.filter(email=email).first() if email else None
        checkout = checkout_models.Checkout.objects.create(
            channel=channel,
            currency=channel.currency_code,
            email=email,
            user=user,
        )
        checkout_lines = [
            checkout_models.CheckoutLine(
                checkout=checkout,
                variant=variant,
                quantity=quantity_by_variant[variant.id],
                currency=channel.currency_code,
                undiscounted_unit_price_amount=listings[variant.id].price_amount
                or Decimal("0"),
                prior_unit_price_amount=listings[variant.id].prior_price_amount,
            )
            for variant in variants
            if variant.id in listings
        ]
        if not checkout_lines:
            return {"ok": False, "error": "Товары из корзины недоступны"}, 400
        checkout_models.CheckoutLine.objects.bulk_create(checkout_lines)

        has_shipping = shipping_amount > 0
        if has_shipping:
            shipping_fields = assign_external_shipping_to_checkout(
                checkout,
                _build_external_shipping_method(
                    shipping_amount, shipping_carrier, checkout.currency
                ),
            )
            if shipping_fields:
                checkout.save(update_fields=shipping_fields)

        manager = get_plugins_manager(allow_replica=False)
        lines, _ = fetch_checkout_lines(checkout)
        checkout_info = fetch_checkout_info(checkout, lines, manager)

        set_disable_quantity_limits(True)
        try:
            if voucher.type == VoucherType.SHIPPING and not has_shipping:
                validate_voucher_for_checkout(manager, voucher, checkout_info, lines)
                discount_amount = Decimal(0)
            else:
                add_promo_code_to_checkout(
                    manager, checkout_info, lines, voucher_code.code
                )
                discount_amount = Decimal(str(checkout.discount_amount or 0))
        except Exception as voucher_error:
            return {"ok": False, "error": _promo_error_message(voucher_error)}, 400
        finally:
            set_disable_quantity_limits(False)

        listing = voucher.channel_listings.filter(channel=channel).first()
        discount_value = float(listing.discount_value or 0) if listing else 0.0
        min_spent = (
            float(listing.min_spent_amount)
            if listing and listing.min_spent_amount
            else None
        )
        is_percentage = voucher.discount_value_type == DiscountValueType.PERCENTAGE
        is_shipping = voucher.type == VoucherType.SHIPPING

        if is_shipping:
            discount_type = "SHIPPING"
        elif is_percentage:
            discount_type = "PERCENTAGE"
        else:
            discount_type = "FIXED"

        return {
            "ok": True,
            "code": voucher_code.code,
            "discountType": discount_type,
            "discountValueType": "PERCENTAGE" if is_percentage else "FIXED",
            "discountValue": discount_value,
            "discountPercent": discount_value if is_percentage else 0,
            "discountAmount": 0.0 if is_shipping else float(discount_amount),
            "shippingDiscountAmount": float(discount_amount) if is_shipping else None,
            "scope": _voucher_scope(voucher),
            "minSpent": min_spent,
            "discountName": voucher.name or "",
        }, 200
