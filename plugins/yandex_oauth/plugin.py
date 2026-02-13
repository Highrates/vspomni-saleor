# Yandex OAuth plugin for Saleor - uses access_token + user_info (no id_token/JWKS)
import json
import logging
import time
from urllib.parse import urlencode

from django.core import signing
from django.core.exceptions import ValidationError
from django.contrib.auth.hashers import make_password
from requests import HTTPError

from ...account.models import User
from ...account.utils import send_user_event
from ...core.http_client import HTTPClient
from ...core.jwt import (
    JWT_ACCESS_TYPE,
    JWT_OWNER_FIELD,
    JWT_REFRESH_TYPE,
    jwt_encode,
    jwt_user_payload,
)
from ...graphql.account.mutations.authentication.utils import _get_new_csrf_token
from ..base_plugin import BasePlugin, ConfigurationTypeField, ExternalAccessTokens
from ..error_codes import PluginErrorCode

from . import PLUGIN_ID

logger = logging.getLogger(__name__)

YANDEX_AUTHORIZE_URL = "https://oauth.yandex.ru/authorize"
YANDEX_TOKEN_URL = "https://oauth.yandex.ru/token"
YANDEX_USER_INFO_URL = "https://login.yandex.ru/info?format=json"

OAUTH_TOKEN_REFRESH_FIELD = "oauth_refresh_token"
CSRF_FIELD = "csrf_token"


class YandexOAuthPlugin(BasePlugin):
    PLUGIN_ID = PLUGIN_ID
    PLUGIN_NAME = "Yandex OAuth"
    CONFIGURATION_PER_CHANNEL = False

    DEFAULT_CONFIGURATION = [
        {"name": "client_id", "value": None},
        {"name": "client_secret", "value": None},
    ]

    CONFIG_STRUCTURE = {
        "client_id": {
            "type": ConfigurationTypeField.STRING,
            "help_text": "Yandex OAuth Client ID",
            "label": "Client ID",
        },
        "client_secret": {
            "type": ConfigurationTypeField.SECRET,
            "help_text": "Yandex OAuth Client Secret",
            "label": "Client Secret",
        },
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        config = {item["name"]: item["value"] for item in self.configuration}
        self.client_id = config.get("client_id") or ""
        self.client_secret = config.get("client_secret") or ""

    def external_authentication_url(self, data: dict, request, previous_value) -> dict:
        if not self.active:
            return previous_value
        redirect_uri = data.get("redirectUri")
        if not redirect_uri:
            raise ValidationError(
                {"redirectUri": ValidationError("Missing redirectUri", code=PluginErrorCode.NOT_FOUND.value)}
            )
        state = signing.dumps({"redirectUri": redirect_uri})
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
        }
        url = YANDEX_AUTHORIZE_URL + "?" + urlencode(params)
        return {"authorizationUrl": url}

    def _fetch_token(self, code: str, redirect_uri: str) -> dict:
        import base64
        auth = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        response = HTTPClient.send_request(
            "POST",
            YANDEX_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {auth}",
            },
        )
        response.raise_for_status()
        return response.json()

    def _fetch_user_info(self, access_token: str) -> dict:
        # Yandex expects "OAuth <token>" for login.yandex.ru/info
        response = HTTPClient.send_request(
            "GET",
            YANDEX_USER_INFO_URL,
            headers={"Authorization": f"OAuth {access_token}"},
        )
        response.raise_for_status()
        return response.json()

    def _yandex_payload_to_oidc_like(self, info: dict) -> dict:
        """Map Yandex user info to OIDC-like payload (email, sub, given_name, family_name)."""
        if isinstance(info, str):
            info = json.loads(info)
        email = info.get("default_email") or (info.get("emails") and info["emails"][0])
        if not email:
            raise ValidationError({"code": ValidationError("Yandex: no email", code=PluginErrorCode.INVALID.value)})
        sub = str(info.get("id", ""))
        if not sub:
            raise ValidationError({"code": ValidationError("Yandex: no user id", code=PluginErrorCode.INVALID.value)})
        real_name = info.get("real_name") or {}
        if isinstance(real_name, str):
            real_name = {}
        return {
            "email": email,
            "sub": sub,
            "given_name": real_name.get("first_name", ""),
            "family_name": real_name.get("last_name", ""),
        }

    def _get_or_create_user(self, payload: dict) -> tuple[User, bool, bool]:
        from django.conf import settings

        oidc_key = f"oidc:{YANDEX_AUTHORIZE_URL}"
        sub = payload["sub"]
        email = payload["email"]
        defaults_create = {
            "is_active": True,
            "is_confirmed": True,
            "email": email,
            "first_name": payload.get("given_name", ""),
            "last_name": payload.get("family_name", ""),
            "private_metadata": {oidc_key: sub},
            "password": make_password(None),
        }
        get_kwargs = {"private_metadata__contains": {oidc_key: sub}}
        created = False
        updated = False
        try:
            user = User.objects.using(settings.DATABASE_CONNECTION_REPLICA_NAME).get(**get_kwargs)
        except User.DoesNotExist:
            user, created = User.objects.get_or_create(
                email=email,
                defaults=defaults_create,
            )
            if not created:
                user.store_value_in_private_metadata({oidc_key: sub})
                user.first_name = defaults_create["first_name"]
                user.last_name = defaults_create["last_name"]
                user.save(update_fields=["private_metadata", "first_name", "last_name"])
                updated = True
        except User.MultipleObjectsReturned:
            user, _ = User.objects.get_or_create(
                email=email,
                defaults=defaults_create,
            )
        if not user.is_active:
            raise ValidationError({"code": ValidationError("User inactive", code=PluginErrorCode.INVALID.value)})
        if not created:
            if user.get_value_from_private_metadata(oidc_key) != sub:
                user.store_value_in_private_metadata({oidc_key: sub})
                updated = True
            if user.first_name != defaults_create["first_name"] or user.last_name != defaults_create["last_name"]:
                user.first_name = defaults_create["first_name"]
                user.last_name = defaults_create["last_name"]
                user.save(update_fields=["first_name", "last_name"])
                updated = True
        return user, created, updated

    def _create_jwt_access(self, user: User, access_token: str, exp_ts: int) -> str:
        additional = {"exp": exp_ts, "oauth_access_key": access_token}
        payload = jwt_user_payload(
            user, JWT_ACCESS_TYPE, exp_delta=None, additional_payload=additional, token_owner=PLUGIN_ID
        )
        return jwt_encode(payload)

    def _create_jwt_refresh(self, user: User, refresh_token: str, csrf: str) -> str:
        additional = {OAUTH_TOKEN_REFRESH_FIELD: refresh_token, CSRF_FIELD: csrf}
        payload = jwt_user_payload(
            user, JWT_REFRESH_TYPE, exp_delta=None, additional_payload=additional, token_owner=PLUGIN_ID
        )
        return jwt_encode(payload)

    def external_obtain_access_tokens(self, data, request, previous_value):
        if not self.active:
            return previous_value
        # Saleor может передать input как JSON-строку
        if isinstance(data, str):
            data = json.loads(data)
        code = data.get("code")
        state_raw = data.get("state")
        if not code or not state_raw:
            raise ValidationError(
                {"code": ValidationError("Missing code or state", code=PluginErrorCode.INVALID.value)}
            )
        try:
            state_data = signing.loads(state_raw)
        except signing.BadSignature:
            raise ValidationError({"state": ValidationError("Bad state", code=PluginErrorCode.INVALID.value)})
        redirect_uri = state_data.get("redirectUri")
        if not redirect_uri:
            raise ValidationError({"state": ValidationError("Bad state", code=PluginErrorCode.INVALID.value)})

        try:
            token_data = self._fetch_token(code, redirect_uri)
        except HTTPError as e:
            logger.warning("Yandex token exchange failed: %s", e)
            raise ValidationError(
                {"code": ValidationError("Yandex token exchange failed", code=PluginErrorCode.INVALID.value)}
            )

        access_token = token_data.get("access_token")
        if not access_token:
            raise ValidationError(
                {"code": ValidationError("No access_token from Yandex", code=PluginErrorCode.INVALID.value)}
            )

        try:
            user_info = self._fetch_user_info(access_token)
        except HTTPError as e:
            logger.warning("Yandex user info failed: %s", e)
            raise ValidationError(
                {"code": ValidationError("Yandex user info failed", code=PluginErrorCode.INVALID.value)}
            )

        payload = self._yandex_payload_to_oidc_like(user_info)
        user, user_created, user_updated = self._get_or_create_user(payload)
        if user_created or user_updated:
            send_user_event(user, user_created, user_updated)

        expires_in = int(token_data.get("expires_in", 31536000))
        exp_ts = int(time.time()) + expires_in
        token = self._create_jwt_access(user, access_token, exp_ts)
        refresh_token = token_data.get("refresh_token")
        csrf_token = _get_new_csrf_token() if refresh_token else None
        refresh_jwt = self._create_jwt_refresh(user, refresh_token or "", csrf_token or "") if refresh_token else None

        return ExternalAccessTokens(
            token=token,
            refresh_token=refresh_jwt,
            csrf_token=csrf_token,
            user=user,
        )
