"""
Celery tasks for sending emails via UniSender API
"""
import logging

from ...account import events as account_events
from ...celeryconf import app
from ...core.db.connection import allow_writer
from ...giftcard import events as gift_card_events
from ...graphql.core.utils import from_global_id_or_none
from ...invoice import events as invoice_events
from ...order import events as order_events
from ..email_common import get_plain_text_message_for_email
from .api_client import UnisenderConfig, send_email_via_unisender
import pybars

logger = logging.getLogger(__name__)


def render_email_template(template_str: str, context: dict, subject: str) -> tuple[str, str]:
    """
    Render email template using Handlebars
    
    Returns:
        Tuple of (html_body, subject)
    """
    compiler = pybars.Compiler()
    template = compiler.compile(template_str)
    subject_template = compiler.compile(subject)
    
    # Import helpers from email_common
    from ..email_common import (
        format_address,
        price,
        format_datetime,
        get_product_image_thumbnail,
        compare,
    )
    
    helpers = {
        "format_address": format_address,
        "price": price,
        "format_datetime": format_datetime,
        "get_product_image_thumbnail": get_product_image_thumbnail,
        "compare": compare,
    }
    
    html_body = template(context, helpers=helpers)
    subject_message = subject_template(context, helpers)
    
    return html_body, subject_message


@app.task(compression="zlib")
def send_account_confirmation_email_task(
    recipient_email, payload, config, subject, template
):
    """Send account confirmation email via UniSender API"""
    try:
        unisender_config = UnisenderConfig(**config)
        logger.info(f"Sending account confirmation email to {recipient_email} via UniSender")
        
        html_body, subject_message = render_email_template(template, payload, subject)
        text_body = get_plain_text_message_for_email(html_body)
        
        send_email_via_unisender(
            config=unisender_config,
            recipient_email=recipient_email,
            subject=subject_message,
            html_body=html_body,
            text_body=text_body,
        )
        logger.info(f"Account confirmation email sent successfully to {recipient_email}")
    except Exception as e:
        logger.error(f"Failed to send account confirmation email to {recipient_email}: {str(e)}", exc_info=True)
        raise


@app.task(compression="zlib")
def send_password_reset_email_task(recipient_email, payload, config, subject, template):
    """Send password reset email via UniSender API"""
    user_id = payload.get("user", {}).get("id")
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    with allow_writer():
        account_events.customer_password_reset_link_sent_event(
            user_id=from_global_id_or_none(user_id)
        )


@app.task(compression="zlib")
def send_request_email_change_email_task(
    recipient_email, payload, config, subject, template
):
    """Send email change request email via UniSender API"""
    user_id = payload.get("user", {}).get("id")
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    with allow_writer():
        account_events.customer_email_change_request_event(
            user_id=from_global_id_or_none(user_id),
            parameters={
                "old_email": payload.get("old_email"),
                "new_email": recipient_email,
            },
        )


@app.task(compression="zlib")
def send_user_change_email_notification_task(
    recipient_email, payload, config, subject, template
):
    """Send email change notification via UniSender API"""
    user_id = payload.get("user", {}).get("id")
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    event_parameters = {
        "old_email": payload.get("old_email"),
        "new_email": payload.get("new_email"),
    }
    with allow_writer():
        account_events.customer_email_changed_event(
            user_id=from_global_id_or_none(user_id), parameters=event_parameters
        )


@app.task(compression="zlib")
def send_account_delete_confirmation_email_task(
    recipient_email, payload, config, subject, template
):
    """Send account delete confirmation email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )


@app.task(compression="zlib")
def send_set_user_password_email_task(
    recipient_email, payload, config, subject, template
):
    """Send set user password email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )


@app.task(compression="zlib")
def send_gift_card_email_task(recipient_email, payload, config, subject, template):
    """Send gift card email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    email_data = {
        "gift_card_id": from_global_id_or_none(payload["gift_card"]["id"]),
        "user_id": from_global_id_or_none(payload["requester_user_id"]),
        "app_id": from_global_id_or_none(payload["requester_app_id"]),
        "email": payload["recipient_email"],
    }
    with allow_writer():
        if payload["resending"] is True:
            gift_card_events.gift_card_resent_event(**email_data)
        else:
            gift_card_events.gift_card_sent_event(**email_data)


@app.task(compression="zlib")
def send_invoice_email_task(recipient_email, payload, config, subject, template):
    """Send invoice email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    with allow_writer():
        invoice_events.notification_invoice_sent_event(
            user_id=from_global_id_or_none(payload["requester_user_id"]),
            app_id=from_global_id_or_none(payload["requester_app_id"]),
            invoice_id=from_global_id_or_none(payload["invoice"]["id"]),
            customer_email=payload["recipient_email"],
        )
        order_events.event_invoice_sent_notification(
            order_id=from_global_id_or_none(payload["invoice"]["order_id"]),
            user_id=from_global_id_or_none(payload["requester_user_id"]),
            app_id=from_global_id_or_none(payload["requester_app_id"]),
            email=payload["recipient_email"],
        )


@app.task(compression="zlib")
def send_order_confirmation_email_task(
    recipient_email, payload, config, subject, template
):
    """Send order confirmation email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    with allow_writer():
        order_events.event_order_confirmation_notification(
            order_id=from_global_id_or_none(payload["order"]["id"]),
            user_id=from_global_id_or_none(payload["order"].get("user_id")),
            customer_email=recipient_email,
        )


@app.task(compression="zlib")
def send_fulfillment_confirmation_email_task(
    recipient_email, payload, config, subject, template
):
    """Send fulfillment confirmation email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    with allow_writer():
        order_events.event_fulfillment_confirmed_notification(
            order_id=from_global_id_or_none(payload["order"]["id"]),
            user_id=from_global_id_or_none(payload["requester_user_id"]),
            app_id=from_global_id_or_none(payload["requester_app_id"]),
            customer_email=recipient_email,
        )

        if payload.get("digital_lines"):
            order_events.event_fulfillment_digital_links_notification(
                order_id=from_global_id_or_none(payload["order"]["id"]),
                user_id=from_global_id_or_none(payload["requester_user_id"]),
                app_id=from_global_id_or_none(payload["requester_app_id"]),
                customer_email=recipient_email,
            )


@app.task(compression="zlib")
def send_fulfillment_update_email_task(
    recipient_email, payload, config, subject, template
):
    """Send fulfillment update email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )


@app.task(compression="zlib")
def send_payment_confirmation_email_task(
    recipient_email, payload, config, subject, template
):
    """Send payment confirmation email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    with allow_writer():
        order_events.event_payment_confirmed_notification(
            order_id=from_global_id_or_none(payload["order"]["id"]),
            user_id=from_global_id_or_none(payload["order"].get("user_id")),
            customer_email=recipient_email,
        )


@app.task(compression="zlib")
def send_order_canceled_email_task(recipient_email, payload, config, subject, template):
    """Send order canceled email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    with allow_writer():
        order_events.event_order_cancelled_notification(
            order_id=from_global_id_or_none(payload["order"]["id"]),
            user_id=from_global_id_or_none(payload["requester_user_id"]),
            app_id=from_global_id_or_none(payload["requester_app_id"]),
            customer_email=recipient_email,
        )


@app.task(compression="zlib")
def send_order_refund_email_task(recipient_email, payload, config, subject, template):
    """Send order refund email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    with allow_writer():
        order_events.event_order_refunded_notification(
            order_id=from_global_id_or_none(payload["order"]["id"]),
            user_id=from_global_id_or_none(payload["requester_user_id"]),
            app_id=from_global_id_or_none(payload["requester_app_id"]),
            customer_email=recipient_email,
        )


@app.task(compression="zlib")
def send_order_confirmed_email_task(
    recipient_email, payload, config, subject, template
):
    """Send order confirmed email via UniSender API"""
    unisender_config = UnisenderConfig(**config)
    
    html_body, subject_message = render_email_template(template, payload, subject)
    text_body = get_plain_text_message_for_email(html_body)
    
    send_email_via_unisender(
        config=unisender_config,
        recipient_email=recipient_email,
        subject=subject_message,
        html_body=html_body,
        text_body=text_body,
    )
    with allow_writer():
        order_events.event_order_confirmed_notification(
            order_id=from_global_id_or_none(payload.get("order", {}).get("id")),
            user_id=from_global_id_or_none(payload.get("requester_user_id")),
            app_id=from_global_id_or_none(payload["requester_app_id"]),
            customer_email=recipient_email,
        )

