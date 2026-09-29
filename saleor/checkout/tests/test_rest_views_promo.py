import json
from decimal import Decimal

import graphene
import pytest
from django.core.cache import cache
from prices import Money

from ...core.db.connection import allow_writer
from ...discount import VoucherType
from ..models import Checkout
from ..rest_views import (
    VOUCHER_VALIDATE_MAX_UNKNOWN_CODES,
    PromoCodeNotApplied,
    _apply_promo_code_without_quantity_limits,
)

VALIDATE_URL = "/voucher/validate/"
CREATE_URL = "/checkout/create-without-stock-check/"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


def _variant_payload(checkout):
    line = checkout.lines.first()
    variant_id = graphene.Node.to_global_id("ProductVariant", line.variant_id)
    return line, variant_id


def _post(client, url, payload, ip="10.0.0.1"):
    with allow_writer():
        return client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_REAL_IP=ip,
        )


def test_apply_promo_code_applies_fixed_voucher(checkout_with_item, voucher):
    checkout = checkout_with_item
    line = checkout.lines.first()
    subtotal = line.variant.channel_listings.get(
        channel=checkout.channel
    ).price_amount * line.quantity

    result = _apply_promo_code_without_quantity_limits(checkout, "mirumee")

    checkout.refresh_from_db()
    assert checkout.voucher_code == "mirumee"
    assert result["discount"] == 20
    assert Decimal(str(result["total"])) == subtotal - Decimal(20)


def test_apply_promo_code_is_case_insensitive(checkout_with_item, voucher):
    result = _apply_promo_code_without_quantity_limits(checkout_with_item, "MIRUMEE")

    assert result["code"] == "mirumee"


def test_apply_promo_code_unknown_code_raises(checkout_with_item, voucher):
    with pytest.raises(PromoCodeNotApplied) as exc:
        _apply_promo_code_without_quantity_limits(checkout_with_item, "nope")

    assert "не найден" in exc.value.message
    checkout_with_item.refresh_from_db()
    assert checkout_with_item.voucher_code is None


def test_apply_promo_code_min_spent_message(checkout_with_item, voucher):
    voucher.channel_listings.update(min_spent_amount=1_000_000)

    with pytest.raises(PromoCodeNotApplied) as exc:
        _apply_promo_code_without_quantity_limits(checkout_with_item, "mirumee")

    assert "от 1000000 ₽" in exc.value.message


def test_validate_percentage_voucher_rolls_back_temp_checkout(
    client, checkout_with_item, voucher_percentage
):
    line, variant_id = _variant_payload(checkout_with_item)
    checkouts_before = Checkout.objects.count()

    response = _post(
        client,
        VALIDATE_URL,
        {
            "promoCode": "saleor",
            "variantIds": [variant_id],
            "quantities": [line.quantity],
            "channel": checkout_with_item.channel.slug,
        },
    )

    data = response.json()
    assert response.status_code == 200, data
    assert data["discountType"] == "PERCENTAGE"
    assert data["discountValueType"] == "PERCENTAGE"
    assert data["discountValue"] == 10
    assert data["scope"] == "ORDER"
    assert data["discountAmount"] > 0
    assert Checkout.objects.count() == checkouts_before


def test_validate_unknown_codes_are_rate_limited(client, checkout_with_item, voucher):
    line, variant_id = _variant_payload(checkout_with_item)
    payload = {
        "promoCode": "wrong",
        "variantIds": [variant_id],
        "quantities": [line.quantity],
        "channel": checkout_with_item.channel.slug,
    }

    for _ in range(VOUCHER_VALIDATE_MAX_UNKNOWN_CODES):
        assert _post(client, VALIDATE_URL, payload).status_code == 400

    assert _post(client, VALIDATE_URL, payload).status_code == 429
    assert _post(client, VALIDATE_URL, payload, ip="10.0.0.2").status_code == 400


def test_validate_shipping_voucher_without_shipping(
    client, checkout_with_item, voucher_free_shipping
):
    line, variant_id = _variant_payload(checkout_with_item)

    response = _post(
        client,
        VALIDATE_URL,
        {
            "promoCode": "saleor",
            "variantIds": [variant_id],
            "quantities": [line.quantity],
            "channel": checkout_with_item.channel.slug,
        },
    )

    data = response.json()
    assert response.status_code == 200, data
    assert data["discountType"] == "SHIPPING"
    assert data["discountValue"] == 100
    assert data["discountAmount"] == 0


def test_validate_shipping_voucher_with_shipping(
    client, checkout_with_item, voucher_free_shipping
):
    line, variant_id = _variant_payload(checkout_with_item)

    response = _post(
        client,
        VALIDATE_URL,
        {
            "promoCode": "saleor",
            "variantIds": [variant_id],
            "quantities": [line.quantity],
            "channel": checkout_with_item.channel.slug,
            "shippingAmount": 350,
            "shippingCarrier": "cdek",
        },
    )

    data = response.json()
    assert response.status_code == 200, data
    assert data["shippingDiscountAmount"] == 350


def test_validate_once_per_customer(
    client, checkout_with_item, voucher, customer_user
):
    from ...discount.models import VoucherCustomer

    voucher.apply_once_per_customer = True
    voucher.save(update_fields=["apply_once_per_customer"])
    VoucherCustomer.objects.create(
        voucher_code=voucher.codes.first(), customer_email=customer_user.email
    )
    line, variant_id = _variant_payload(checkout_with_item)

    response = _post(
        client,
        VALIDATE_URL,
        {
            "promoCode": "mirumee",
            "variantIds": [variant_id],
            "quantities": [line.quantity],
            "channel": checkout_with_item.channel.slug,
            "email": customer_user.email,
        },
    )

    assert response.status_code == 400
    assert response.json()["error"] == "Вы уже использовали этот промокод"


def test_create_checkout_rejects_inapplicable_promo(
    client, checkout_with_item, voucher
):
    voucher.channel_listings.update(min_spent_amount=1_000_000)
    line, variant_id = _variant_payload(checkout_with_item)
    checkouts_before = Checkout.objects.count()

    response = _post(
        client,
        CREATE_URL,
        {
            "channel": checkout_with_item.channel.slug,
            "email": "buyer@example.com",
            "lines": [{"variantId": variant_id, "quantity": line.quantity}],
            "promoCode": "mirumee",
        },
    )

    data = response.json()
    assert response.status_code == 400, data
    assert data["code"] == "PROMO_CODE_NOT_APPLIED"
    assert Checkout.objects.count() == checkouts_before


def test_create_checkout_applies_promo_to_total(client, checkout_with_item, voucher):
    line, variant_id = _variant_payload(checkout_with_item)
    price = line.variant.channel_listings.get(
        channel=checkout_with_item.channel
    ).price_amount

    response = _post(
        client,
        CREATE_URL,
        {
            "channel": checkout_with_item.channel.slug,
            "email": "buyer@example.com",
            "lines": [{"variantId": variant_id, "quantity": line.quantity}],
            "promoCode": "mirumee",
        },
    )

    data = response.json()
    assert response.status_code == 200, data
    assert data["promo"]["code"] == "mirumee"
    assert Decimal(str(data["total"]["amount"])) == price * line.quantity - 20
    created = Checkout.objects.get(token=data["checkout"]["token"])
    assert created.voucher_code == "mirumee"


def test_create_checkout_applies_shipping_voucher_with_external_shipping(
    client, checkout_with_item, voucher_free_shipping
):
    line, variant_id = _variant_payload(checkout_with_item)
    price = line.variant.channel_listings.get(
        channel=checkout_with_item.channel
    ).price_amount

    response = _post(
        client,
        CREATE_URL,
        {
            "channel": checkout_with_item.channel.slug,
            "email": "buyer@example.com",
            "lines": [{"variantId": variant_id, "quantity": line.quantity}],
            "promoCode": "saleor",
            "shippingAmount": 350,
            "shippingCarrier": "cdek",
        },
    )

    data = response.json()
    assert response.status_code == 200, data
    assert Decimal(str(data["total"]["amount"])) == price * line.quantity
    assert voucher_free_shipping.type == VoucherType.SHIPPING


ADDRESS = {
    "firstName": "Иван",
    "lastName": "Иванов",
    "streetAddress1": "ул. Ленина, 1",
    "city": "Москва",
    "postalCode": "101000",
    "phone": "+79990000000",
    "country": "RU",
}


def test_promo_flow_create_ship_complete_keeps_discount(
    client, checkout_with_item, voucher
):
    from ...order.models import Order

    line, variant_id = _variant_payload(checkout_with_item)
    price = line.variant.channel_listings.get(
        channel=checkout_with_item.channel
    ).price_amount
    expected_total = price * line.quantity - 20 + 350

    created = _post(
        client,
        CREATE_URL,
        {
            "channel": checkout_with_item.channel.slug,
            "email": "buyer@example.com",
            "lines": [{"variantId": variant_id, "quantity": line.quantity}],
            "address": ADDRESS,
            "promoCode": "mirumee",
            "shippingAmount": 350,
            "shippingCarrier": "cdek",
        },
    ).json()
    token = created["checkout"]["token"]

    shipped = _post(
        client,
        "/checkout/apply-external-shipping/",
        {"checkoutId": token, "shippingAmount": 350, "shippingCarrier": "cdek"},
    ).json()
    assert Decimal(str(shipped["total"]["amount"])) == expected_total

    completed = _post(
        client,
        "/checkout/complete-without-stock-check/",
        {
            "checkoutId": token,
            "email": "buyer@example.com",
            "paymentId": "pay-1",
            "paymentAmount": str(expected_total),
            "shippingAmount": 350,
            "shippingCarrier": "cdek",
            "address": ADDRESS,
        },
    )
    data = completed.json()
    assert completed.status_code == 200, data

    order = Order.objects.get(id=data["order"]["id"])
    assert order.voucher_code == "mirumee"
    assert order.total_gross_amount == expected_total
    assert order.shipping_price_gross_amount == Decimal(350)

    from ...account.order_api import serialize_order

    with allow_writer():
        payload = serialize_order(order, include_lines=False)
    assert payload["voucherCode"] == "mirumee"
    assert payload["promoDiscount"]["gross"]["amount"] == 2000


def test_promo_flow_rejects_payment_without_discount(
    client, checkout_with_item, voucher
):
    line, variant_id = _variant_payload(checkout_with_item)
    price = line.variant.channel_listings.get(
        channel=checkout_with_item.channel
    ).price_amount
    full_price_total = price * line.quantity + 350

    token = _post(
        client,
        CREATE_URL,
        {
            "channel": checkout_with_item.channel.slug,
            "email": "buyer@example.com",
            "lines": [{"variantId": variant_id, "quantity": line.quantity}],
            "address": ADDRESS,
            "promoCode": "mirumee",
            "shippingAmount": 350,
            "shippingCarrier": "cdek",
        },
    ).json()["checkout"]["token"]

    completed = _post(
        client,
        "/checkout/complete-without-stock-check/",
        {
            "checkoutId": token,
            "email": "buyer@example.com",
            "paymentId": "pay-2",
            "paymentAmount": str(full_price_total),
            "shippingAmount": 350,
            "shippingCarrier": "cdek",
            "address": ADDRESS,
        },
    )

    assert completed.status_code == 409
    assert completed.json()["code"] == "PAYMENT_AMOUNT_MISMATCH"


def test_align_order_keeps_shipping_voucher_discount(voucher_free_shipping, order):
    from ..rest_views import _align_order_with_external_shipping_payment

    class _Checkout:
        undiscounted_base_shipping_price_amount = Decimal(350)
        external_shipping_method_id = "ext"

    order.voucher = voucher_free_shipping
    order.subtotal_gross_amount = Decimal(100)
    order.total_gross_amount = Decimal(450)
    order.save()

    order = _align_order_with_external_shipping_payment(order, _Checkout(), 100)

    assert order.total_gross_amount == Decimal(100)
    assert order.shipping_price_gross_amount == Decimal(0)
    assert order.undiscounted_base_shipping_price_amount == Decimal(350)
    assert Money(order.total_gross_amount, order.currency).amount == Decimal(100)
