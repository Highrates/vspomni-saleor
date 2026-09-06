"""Shared helpers for customer-facing order REST API."""

from __future__ import annotations

import re
from decimal import Decimal

from ..order import OrderChargeStatus, OrderStatus

CARRIER_LABELS = {
    "cdek": "СДЭК",
    "yandex": "Яндекс Доставка",
    "ozon": "Ozon",
}

CHARGE_STATUS_LABELS = {
    OrderChargeStatus.NONE: "Не оплачен",
    OrderChargeStatus.PARTIAL: "Частично оплачен",
    OrderChargeStatus.FULL: "Оплачен",
    OrderChargeStatus.OVERCHARGED: "Оплачен",
}

_VSP_META_RE = re.compile(r"^__VSP:carrier=(cdek|yandex|ozon)(.*)__$")


def _money_to_kopecks(amount: Decimal | float | int | None) -> int:
    if amount is None:
        return 0
    return int(Decimal(str(amount)) * 100)


def parse_vsp_address_meta(street_address_2: str | None) -> dict:
    """Parse __VSP:carrier=... metadata from street_address_2 first line."""
    if not street_address_2:
        return {"carrier": "cdek", "dropoff": "pvz"}

    first_line = street_address_2.strip().split("\n", 1)[0].strip()
    match = _VSP_META_RE.match(first_line)
    if not match:
        return {"carrier": "cdek", "dropoff": "pvz"}

    carrier = match.group(1)
    tail = match.group(2) or ""
    meta: dict = {"carrier": carrier, "dropoff": "pvz"}

    for segment in tail.split("|"):
        if not segment or "=" not in segment:
            continue
        key, value = segment.split("=", 1)
        if key == "dropoff" and value in ("pvz", "courier"):
            meta["dropoff"] = value
        elif key == "pvz" and value:
            if carrier == "ozon":
                meta["ozon_pvz_id"] = value
            else:
                meta["yandex_pvz_id"] = value
        elif key == "ozonPvz" and value:
            meta["ozon_pvz_id"] = value
        elif key in ("lon", "lat"):
            try:
                meta[key] = float(value)
            except ValueError:
                pass

    if meta["dropoff"] == "pvz":
        return meta
    if meta.get("yandex_pvz_id") or meta.get("ozon_pvz_id"):
        meta["dropoff"] = "pvz"
    elif meta.get("lon") is not None and meta.get("lat") is not None:
        meta["dropoff"] = "courier"
    return meta


def get_delivery_carrier(order) -> str:
    addr = order.shipping_address
    if not addr:
        method_name = (order.shipping_method_name or "").lower()
        if "yandex" in method_name or "яндекс" in method_name:
            return "yandex"
        if "ozon" in method_name:
            return "ozon"
        return "cdek"
    return parse_vsp_address_meta(addr.street_address_2).get("carrier", "cdek")


def format_delivery_summary(order) -> str | None:
    addr = order.shipping_address
    if not addr:
        return None

    meta = parse_vsp_address_meta(addr.street_address_2)
    carrier = meta.get("carrier", "cdek")
    carrier_label = CARRIER_LABELS.get(carrier, carrier)
    street = (addr.street_address_1 or "").strip()
    city = (addr.city or "").strip()

    street_lower = street.lower()
    if street and (
        "пвз:" in street_lower
        or carrier_label.lower() in street_lower
        or street.startswith(("Ozon", "СДЭК", "Яндекс"))
    ):
        return street

    mode_label = "ПВЗ" if meta.get("dropoff") == "pvz" else "Курьер"
    parts = [p for p in (city, street) if p]
    location = ", ".join(parts) if parts else street or city
    return f"{carrier_label}, {mode_label}: {location}"


def get_customer_order_status(order) -> tuple[str, str]:
    """
    Map Saleor order to customer-facing status.

    FULFILLED = shipped (Отправлен), NOT delivered.
    Delivery states (В пути / Доставлен) come from order.metadata.vsp_delivery_status.
    Packing state (Собираем) from metadata vsp_fulfillment_status=packing.
    """
    meta = order.metadata or {}
    delivery_status = (meta.get("vsp_delivery_status") or "").strip().lower()
    fulfillment_status = (meta.get("vsp_fulfillment_status") or "").strip().lower()

    if order.status == OrderStatus.CANCELED:
        return "canceled", "Отменён"
    if delivery_status == "delivered":
        return "delivered", "Доставлен"
    if delivery_status == "in_transit":
        return "in_transit", "В пути"
    if order.status == OrderStatus.FULFILLED:
        return "shipped", "Отправлен"
    if fulfillment_status == "packing" or order.status == OrderStatus.PARTIALLY_FULFILLED:
        return "packing", "Собираем"
    if order.status in (OrderStatus.UNFULFILLED, OrderStatus.UNCONFIRMED):
        return "paid", "Оплачен"
    return "paid", "Оплачен"


def is_active_customer_order(status_code: str) -> bool:
    return status_code not in ("delivered", "canceled")


def _phone_to_str(phone) -> str:
    if phone is None:
        return ""
    return str(phone)


def serialize_address(addr) -> dict | None:
    if not addr:
        return None
    meta = parse_vsp_address_meta(addr.street_address_2)
    carrier = meta.get("carrier", "cdek")
    comment_lines = (addr.street_address_2 or "").split("\n")
    user_comment = ""
    if len(comment_lines) > 1:
        user_comment = "\n".join(comment_lines[1:]).strip()

    return {
        "firstName": addr.first_name,
        "lastName": addr.last_name,
        "phone": _phone_to_str(addr.phone),
        "city": addr.city,
        "postalCode": addr.postal_code,
        "streetAddress1": addr.street_address_1,
        "streetAddress2": addr.street_address_2,
        "countryArea": addr.country_area,
        "companyName": addr.company_name,
        "carrier": carrier,
        "carrierLabel": CARRIER_LABELS.get(carrier, carrier),
        "dropoff": meta.get("dropoff", "pvz"),
        "dropoffLabel": "ПВЗ" if meta.get("dropoff") == "pvz" else "Курьер",
        "summary": format_delivery_summary_from_address(addr),
        "comment": user_comment,
    }


def format_delivery_summary_from_address(addr) -> str:
    meta = parse_vsp_address_meta(addr.street_address_2)
    carrier = meta.get("carrier", "cdek")
    carrier_label = CARRIER_LABELS.get(carrier, carrier)
    street = (addr.street_address_1 or "").strip()
    city = (addr.city or "").strip()

    street_lower = street.lower()
    if street and (
        "пвз:" in street_lower
        or carrier_label.lower() in street_lower
        or street.startswith(("Ozon", "СДЭК", "Яндекс"))
    ):
        return street

    mode_label = "ПВЗ" if meta.get("dropoff") == "pvz" else "Курьер"
    parts = [p for p in (city, street) if p]
    location = ", ".join(parts) if parts else street or city
    return f"{carrier_label}, {mode_label}: {location}"


def _is_tracking_url(value: str) -> bool:
    lowered = value.lower()
    return lowered.startswith("http://") or lowered.startswith("https://")


def serialize_fulfillments(order) -> list[dict]:
    fulfillments = []
    for fulfillment in order.fulfillments.all().order_by("created_at"):
        tracking_number = (fulfillment.tracking_number or "").strip()
        if not tracking_number:
            continue
        fulfillments.append(
            {
                "id": str(fulfillment.id),
                "trackingNumber": tracking_number,
                "isTrackingUrl": _is_tracking_url(tracking_number),
                "created": fulfillment.created_at.isoformat(),
            }
        )
    return fulfillments


def serialize_order_line(line, currency: str) -> dict:
    thumbnail_url = None
    try:
        if line.variant and line.variant.product:
            product_media = line.variant.product.media.filter(type="IMAGE").first()
            if product_media and product_media.image:
                thumbnail_url = product_media.image.url
    except Exception:
        thumbnail_url = None

    return {
        "id": str(line.id),
        "productName": line.product_name,
        "variantName": line.variant_name or "",
        "quantity": line.quantity,
        "unitPrice": {
            "gross": {
                "amount": _money_to_kopecks(line.unit_price_gross_amount),
                "currency": currency,
            }
        },
        "undiscountedUnitPrice": {
            "gross": {
                "amount": _money_to_kopecks(line.undiscounted_unit_price_gross_amount),
                "currency": currency,
            }
        },
        "lineTotal": {
            "gross": {
                "amount": _money_to_kopecks(
                    Decimal(str(line.unit_price_gross_amount)) * line.quantity
                ),
                "currency": currency,
            }
        },
        "thumbnail": {
            "url": thumbnail_url,
            "alt": line.product_name,
        },
    }


def serialize_order(order, *, include_lines: bool = True) -> dict:
    status_code, status_display = get_customer_order_status(order)
    carrier = get_delivery_carrier(order)
    currency = order.currency

    subtotal = Decimal(str(order.subtotal_gross_amount or 0))
    shipping = Decimal(str(order.shipping_price_gross_amount or 0))
    total = Decimal(str(order.total_gross_amount or 0))

    fulfillments = serialize_fulfillments(order)
    tracking_numbers = [item["trackingNumber"] for item in fulfillments]

    payload: dict = {
        "id": str(order.id),
        "number": order.number or str(order.id),
        "created": order.created_at.isoformat(),
        "status": order.status,
        "statusCode": status_code,
        "statusDisplay": status_display,
        "fulfillments": fulfillments,
        "trackingNumbers": tracking_numbers,
        "trackingNumber": tracking_numbers[-1] if tracking_numbers else None,
        "chargeStatus": order.charge_status,
        "chargeStatusDisplay": CHARGE_STATUS_LABELS.get(
            order.charge_status, order.charge_status
        ),
        "carrier": carrier,
        "carrierLabel": CARRIER_LABELS.get(carrier, carrier),
        "deliverySummary": format_delivery_summary(order),
        "shippingAddress": serialize_address(order.shipping_address),
        "billingAddress": serialize_address(order.billing_address),
        "shippingMethodName": order.shipping_method_name,
        "subtotal": {
            "gross": {"amount": _money_to_kopecks(subtotal), "currency": currency}
        },
        "shipping": {
            "gross": {"amount": _money_to_kopecks(shipping), "currency": currency},
            "methodName": order.shipping_method_name,
            "carrier": carrier,
            "carrierLabel": CARRIER_LABELS.get(carrier, carrier),
        },
        "total": {
            "gross": {"amount": _money_to_kopecks(total), "currency": currency}
        },
        "metadata": order.metadata or {},
    }

    if include_lines:
        payload["lines"] = [
            serialize_order_line(line, currency) for line in order.lines.all()
        ]

    return payload
