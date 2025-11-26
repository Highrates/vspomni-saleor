"""
UniSender API client for sending emails via HTTP
"""
import logging
from dataclasses import dataclass
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class UnisenderConfig:
    """Configuration for UniSender API"""
    api_key: str
    sender_name: str = ""
    sender_address: str = ""
    api_url: str = "https://api.unisender.com/ru/api/sendEmail"


def send_email_via_unisender(
    config: UnisenderConfig,
    recipient_email: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
) -> dict[str, Any]:
    """
    Send email via UniSender API using sendEmail method
    
    Args:
        config: UniSender configuration
        recipient_email: Recipient email address
        subject: Email subject
        html_body: HTML email body
        text_body: Plain text email body (optional)
    
    Returns:
        Response from UniSender API
    
    Raises:
        requests.RequestException: If API request fails
    """
    if not config.api_key:
        raise ValueError("UniSender API key is required")
    
    if not config.sender_address:
        raise ValueError("Sender email address is required")
    
    # Prepare request data for sendEmail method
    # Documentation: https://www.unisender.com/ru/support/api/messages/sendemail/
    data = {
        "format": "json",
        "api_key": config.api_key,
        "email": recipient_email,
        "sender_name": config.sender_name or config.sender_address.split("@")[0],
        "sender_email": config.sender_address,
        "subject": subject,
        "body": html_body,
    }
    
    # Add text body if provided (UniSender supports text_body parameter)
    if text_body:
        data["text_body"] = text_body
    
    logger.warning(f"[EMAIL DEBUG] Sending email via UniSender API to {recipient_email}")
    logger.warning(f"[EMAIL DEBUG] UniSender API URL: {config.api_url}")
    logger.warning(f"[EMAIL DEBUG] API Key: {config.api_key[:10]}... (first 10 chars)")
    logger.warning(f"[EMAIL DEBUG] Sender: {config.sender_address}")
    logger.warning(f"[EMAIL DEBUG] Request data keys: {list(data.keys())}")
    
    try:
        response = requests.post(
            config.api_url,
            data=data,
            timeout=30,
        )
        
        logger.warning(f"[EMAIL DEBUG] Response status: {response.status_code}")
        logger.warning(f"[EMAIL DEBUG] Response text: {response.text[:500]}")
        
        # Try to parse JSON response even if status is not 200
        try:
            result = response.json()
        except Exception:
            result = {"error": response.text, "code": "unknown"}
        
        # Check for errors in response
        if result.get("error") or result.get("code") == "invalid_api_key":
            error_msg = result.get("error", "Unknown error")
            error_code = result.get("code", "unknown")
            logger.error(f"UniSender API error [{error_code}]: {error_msg}")
            
            if error_code == "invalid_api_key":
                raise ValueError(
                    f"Invalid UniSender API key. Please check your API key in Dashboard → Configuration → Plugins → UniSender Email (API). "
                    f"Error: {error_msg}"
                )
            else:
                raise Exception(f"UniSender API error [{error_code}]: {error_msg}")
        
        # Raise for status only if we haven't handled the error above
        response.raise_for_status()
        
        # Check if result contains job_id (successful send)
        if "result" in result and result.get("result", {}).get("job_id"):
            logger.info(f"Email sent successfully via UniSender API. Job ID: {result['result']['job_id']}")
        else:
            logger.info(f"Email sent successfully via UniSender API. Result: {result}")
        
        return result
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to send email via UniSender API: {e}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Unexpected error sending email via UniSender API: {e}", exc_info=True)
        raise

