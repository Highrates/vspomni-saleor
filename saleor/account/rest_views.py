import json
from datetime import timedelta
from random import randint

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from ..account.error_codes import AccountErrorCode
from ..account.models import EmailVerificationCode, User
from ..account.throttling import authenticate_with_throttling
from ..core.jwt import create_access_token, create_refresh_token
from ..graphql.account.mutations.authentication.create_token import (
    update_user_last_login_if_required,
)
from ..graphql.account.mutations.authentication.utils import _get_new_csrf_token
from ..graphql.site.dataloaders import get_site_promise


OTP_EXPIRATION_MINUTES = 10


def _generate_verification_code() -> str:
  # 6-значный числовой код, с ведущими нулями
  return f"{randint(0, 999999):06d}"


@method_decorator(csrf_exempt, name="dispatch")
class AuthLoginView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')

            if not email or not password:
                return JsonResponse(
                    {'error': 'Email and password are required'},
                    status=400
                )

            user = authenticate_with_throttling(request, email, password)
            if not user:
                return JsonResponse(
                    {'error': 'Invalid credentials'},
                    status=401
                )

            site_settings = get_site_promise(request).get().settings
            if (
                not user.is_confirmed
                and not site_settings.allow_login_without_confirmation
                and site_settings.enable_account_confirmation_by_email
            ):
                return JsonResponse(
                    {'error': 'Account needs to be confirmed via email'},
                    status=403
                )

            if not user.is_active:
                return JsonResponse(
                    {'error': 'Account inactive'},
                    status=403
                )

            csrf_token = _get_new_csrf_token()
            access_token = create_access_token(user)
            refresh_token = create_refresh_token(
                user,
                additional_payload={"csrfToken": csrf_token}
            )

            update_user_last_login_if_required(user)

            return JsonResponse({
                'token': access_token,
                'refreshToken': refresh_token,
                'csrfToken': csrf_token,
                'user': {
                    'id': str(user.id),
                    'email': user.email,
                    'firstName': user.first_name,
                    'lastName': user.last_name,
                    'isActive': user.is_active,
                    'isConfirmed': user.is_confirmed,
                }
            })

        except json.JSONDecodeError:
            return JsonResponse(
                {'error': 'Invalid JSON'},
                status=400
            )
        except Exception as e:
            return JsonResponse(
                {'error': str(e)},
                status=500
            )


@method_decorator(csrf_exempt, name='dispatch')
class AuthSignupView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')
            firstName = data.get('firstName')
            lastName = data.get('lastName')

            if not email or not password:
                return JsonResponse(
                    {'error': 'Email and password are required'},
                    status=400
                )

            if User.objects.filter(email=email).exists():
                return JsonResponse(
                    {'error': 'User with this email already exists'},
                    status=400
                )

            from django.contrib.auth.password_validation import validate_password
            from django.core.exceptions import ValidationError as DjangoValidationError

            user = User(email=email.lower())
            if firstName:
                user.first_name = firstName
            if lastName:
                user.last_name = lastName

            try:
                validate_password(password, user)
            except DjangoValidationError as e:
                return JsonResponse(
                    {'error': '; '.join(e.messages)},
                    status=400
                )

            user.set_password(password)
            user.save()

            # Refresh user to ensure ID is set
            user.refresh_from_db()

            site = get_site_promise(request).get()
            requires_confirmation = site.settings.enable_account_confirmation_by_email

            if requires_confirmation:
                from ..account.tasks import finish_creating_user
                from ..account.utils import RequestorAwareContext
                from ..core.utils.url import prepare_url
                from urllib.parse import urlencode
                from ..core.tokens import token_generator
                from ..channel.models import Channel

                redirect_url = data.get('redirectUrl', 'https://vspomni.store')
                
                # Get default channel
                channel = Channel.objects.filter(is_active=True).first()
                channel_slug = channel.slug if channel else None

                # Create context_data
                context_data = RequestorAwareContext.create_context_data(
                    RequestorAwareContext(
                        allow_replica=True,
                        user=user,
                        app=None,
                    )
                )

                # Verify user.id is set before calling task
                if not user.id:
                    return JsonResponse(
                        {'error': 'Failed to create user'},
                        status=500
                    )

                finish_creating_user.delay(user.id, redirect_url, channel_slug, context_data)

            return JsonResponse({
                'success': True,
                'requiresConfirmation': requires_confirmation,
                'message': 'Registration successful. Please check your email for confirmation.' if requires_confirmation else 'Registration successful.'
            })

        except json.JSONDecodeError:
            return JsonResponse(
                {'error': 'Invalid JSON'},
                status=400
            )
        except Exception as e:
            return JsonResponse(
                {'error': str(e)},
                status=500
            )


@method_decorator(csrf_exempt, name='dispatch')
class AuthMeView(View):
    def get(self, request):
        from ..core.auth_backend import load_user_from_request

        user = load_user_from_request(request)
        if not user:
            return JsonResponse(
                {'error': 'Unauthorized'},
                status=401
            )

        return JsonResponse({
            'id': str(user.id),
            'email': user.email,
            'firstName': user.first_name,
            'lastName': user.last_name,
            'isActive': user.is_active,
            'isConfirmed': user.is_confirmed,
        })


@method_decorator(csrf_exempt, name='dispatch')
class SendRegistrationEmailView(View):
    """Deprecated: оставлен для совместимости. Используй RequestEmailCodeView."""

    def post(self, request):
        from django.core.mail import get_connection, send_mail

        try:
            data = json.loads(request.body)
            email = data.get("email")
            first_name = data.get("firstName") or ""

            if not email:
                return JsonResponse(
                    {"error": "email is required"},
                    status=400,
                )

            subject = "Подтверждение регистрации в VSPOMNI"
            message = (
                f"Здравствуйте, {first_name or 'друг'}!\n\n"
                "Спасибо за регистрацию на vspomni.store.\n\n"
                "Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо."
            )

            # IMPORTANT: protect from hanging SMTP connections (common on servers)
            connection = get_connection(
                timeout=10,  # seconds
            )
            sent = send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
                connection=connection,
            )

            return JsonResponse(
                {
                    "ok": True,
                    "sent": sent,
                    "email_backend": getattr(settings, "EMAIL_BACKEND", ""),
                    "email_host": getattr(settings, "EMAIL_HOST", ""),
                    "email_port": getattr(settings, "EMAIL_PORT", ""),
                    "email_use_tls": getattr(settings, "EMAIL_USE_TLS", False),
                    "default_from_email": getattr(settings, "DEFAULT_FROM_EMAIL", ""),
                }
            )
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            return JsonResponse(
                {
                    "ok": False,
                    "error": str(e),
                    "email_backend": getattr(settings, "EMAIL_BACKEND", ""),
                    "email_host": getattr(settings, "EMAIL_HOST", ""),
                    "email_port": getattr(settings, "EMAIL_PORT", ""),
                    "email_use_tls": getattr(settings, "EMAIL_USE_TLS", False),
                    "default_from_email": getattr(settings, "DEFAULT_FROM_EMAIL", ""),
                },
                status=500,
            )


@method_decorator(csrf_exempt, name="dispatch")
class RequestEmailCodeView(View):
    """Отправить одноразовый код подтверждения email."""

    def post(self, request):
        from django.core.mail import get_connection, send_mail

        try:
            data = json.loads(request.body)
            email = (data.get("email") or "").strip().lower()
            first_name = (data.get("firstName") or "").strip()

            if not email:
                return JsonResponse({"error": "email is required"}, status=400)

            # Генерируем новый код и инвалидируем старые активные
            code = _generate_verification_code()
            phone = (data.get("phone") or "").strip()
            EmailVerificationCode.objects.filter(
                email=email, is_used=False
            ).delete()
            EmailVerificationCode.objects.create(email=email, code=code, phone=phone)

            subject = "Код подтверждения регистрации в VSPOMNI"
            message = (
                f"Здравствуйте, {first_name or 'друг'}!\n\n"
                f"Ваш код подтверждения: {code}\n"
                f"Он действует {OTP_EXPIRATION_MINUTES} минут.\n\n"
                "Если вы не регистрировались на vspomni.store, просто проигнорируйте это письмо."
            )

            connection = get_connection(timeout=10)
            sent = send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
                connection=connection,
            )

            return JsonResponse({"ok": True, "sent": sent})
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            return JsonResponse({"ok": False, "error": str(e)}, status=500)


@method_decorator(csrf_exempt, name="dispatch")
class VerifyEmailCodeView(View):
    """Проверка кода подтверждения и автоматический логин пользователя."""

    def post(self, request):
        from ..account.models import Address

        try:
            data = json.loads(request.body)
            email = (data.get("email") or "").strip().lower()
            code = (data.get("code") or "").strip()

            if not email or not code:
                return JsonResponse(
                    {"error": "email and code are required"}, status=400
                )

            now = timezone.now()
            valid_from = now - timedelta(minutes=OTP_EXPIRATION_MINUTES)

            ver = (
                EmailVerificationCode.objects.filter(
                    email=email,
                    code=code,
                    is_used=False,
                    created_at__gte=valid_from,
                )
                .order_by("-created_at")
                .first()
            )

            if not ver:
                return JsonResponse(
                    {"ok": False, "error": "Неверный или просроченный код"},
                    status=400,
                )

            ver.is_used = True
            ver.save(update_fields=["is_used"])

            user = User.objects.filter(email=email).first()
            if not user:
                return JsonResponse(
                    {"ok": False, "error": "Пользователь с таким email не найден"},
                    status=400,
                )

            # Подтверждаем и активируем пользователя
            user.is_confirmed = True
            user.is_active = True
            user.save(update_fields=["is_confirmed", "is_active"])

            # Создаём адрес с телефоном, если телефон был указан при регистрации
            # Получаем телефон из кода подтверждения или из запроса
            phone = data.get("phone", "").strip()
            if not phone and ver:
                phone = ver.phone or ""
            
            if phone and not user.addresses.exists():
                # Создаём минимальный адрес с телефоном
                address = Address.objects.create(
                    first_name=user.first_name or "",
                    last_name=user.last_name or "",
                    phone=phone,
                    country="RU",  # Default country
                )
                user.addresses.add(address)
                user.default_shipping_address = address
                user.default_billing_address = address
                user.save(update_fields=["default_shipping_address", "default_billing_address"])

            # Автоматический логин: создаём токены как в AuthLoginView
            csrf_token = _get_new_csrf_token()
            access_token = create_access_token(user)
            refresh_token = create_refresh_token(
                user,
                additional_payload={"csrfToken": csrf_token},
            )

            update_user_last_login_if_required(user)

            return JsonResponse(
                {
                    "ok": True,
                    "token": access_token,
                    "refreshToken": refresh_token,
                    "csrfToken": csrf_token,
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                        "firstName": user.first_name,
                        "lastName": user.last_name,
                        "isActive": user.is_active,
                        "isConfirmed": user.is_confirmed,
                    },
                }
            )
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            return JsonResponse({"ok": False, "error": str(e)}, status=500)


@method_decorator(csrf_exempt, name="dispatch")
class ForgotPasswordView(View):
    """Запрос на сброс пароля."""

    def post(self, request):
        from django.core.mail import get_connection, send_mail

        try:
            data = json.loads(request.body)
            email = (data.get("email") or "").strip().lower()

            if not email:
                return JsonResponse(
                    {"ok": False, "error": "email is required"}, status=400
                )

            # Проверяем, существует ли пользователь с таким email
            user = User.objects.filter(email=email).first()
            if not user:
                return JsonResponse(
                    {"ok": False, "error": "Пользователь с таким email не найден"},
                    status=400,
                )

            # Генерируем токен для сброса пароля
            from ..core.tokens import token_generator
            token = token_generator.make_token(user)

            # Отправляем письмо с инструкциями
            subject = "Сброс пароля в VSPOMNI"
            reset_url = f"{settings.FRONTEND_URL or 'https://vspomni.store'}/login?token={token}&email={email}"
            message = (
                f"Здравствуйте, {user.first_name or 'друг'}!\n\n"
                f"Вы запросили сброс пароля на vspomni.store.\n\n"
                f"Для сброса пароля перейдите по ссылке:\n{reset_url}\n\n"
                "Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо."
            )

            connection = get_connection(timeout=10)
            sent = send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
                connection=connection,
            )

            return JsonResponse({"ok": True, "sent": sent})
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            return JsonResponse({"ok": False, "error": str(e)}, status=500)


@method_decorator(csrf_exempt, name="dispatch")
class ResetPasswordView(View):
    """Сброс пароля по токену."""

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        from ..core.tokens import token_generator

        try:
            data = json.loads(request.body)
            email = (data.get("email") or "").strip().lower()
            token = (data.get("token") or "").strip()
            new_password = data.get("newPassword")

            if not email or not token or not new_password:
                return JsonResponse(
                    {"ok": False, "error": "email, token and newPassword are required"},
                    status=400,
                )

            user = User.objects.filter(email=email).first()
            if not user:
                return JsonResponse(
                    {"ok": False, "error": "Пользователь с таким email не найден"},
                    status=400,
                )

            # Проверяем токен
            if not token_generator.check_token(user, token):
                return JsonResponse(
                    {"ok": False, "error": "Неверный или просроченный токен"},
                    status=400,
                )

            # Валидируем новый пароль
            try:
                validate_password(new_password, user)
            except DjangoValidationError as e:
                error_messages = "; ".join(e.messages)
                return JsonResponse(
                    {"ok": False, "error": error_messages}, status=400
                )

            # Устанавливаем новый пароль
            user.set_password(new_password)
            user.save(update_fields=["password"])

            return JsonResponse({"ok": True})
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            return JsonResponse({"ok": False, "error": str(e)}, status=500)


@method_decorator(csrf_exempt, name="dispatch")
class ChangePasswordView(View):
    """Смена пароля пользователя."""

    def post(self, request):
        from ..core.auth_backend import load_user_from_request
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            user = load_user_from_request(request)
            if not user:
                return JsonResponse(
                    {"ok": False, "error": "Unauthorized"}, status=401
                )

            data = json.loads(request.body)
            old_password = data.get("oldPassword")
            new_password = data.get("newPassword")

            if not old_password or not new_password:
                return JsonResponse(
                    {"ok": False, "error": "oldPassword and newPassword are required"},
                    status=400,
                )

            # Проверяем старый пароль
            if not user.check_password(old_password):
                return JsonResponse(
                    {"ok": False, "error": "Неверный текущий пароль"}, status=400
                )

            # Валидируем новый пароль
            try:
                validate_password(new_password, user)
            except DjangoValidationError as e:
                error_messages = "; ".join(e.messages)
                return JsonResponse(
                    {"ok": False, "error": error_messages}, status=400
                )

            # Устанавливаем новый пароль
            user.set_password(new_password)
            user.save(update_fields=["password"])

            return JsonResponse({"ok": True})
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            return JsonResponse({"ok": False, "error": str(e)}, status=500)

