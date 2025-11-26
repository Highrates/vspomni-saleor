import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views import View

from ..account.throttling import authenticate_with_throttling
from ..core.jwt import create_access_token, create_refresh_token
from ..account.models import User
from ..account.error_codes import AccountErrorCode
from django.core.exceptions import ValidationError
from ..graphql.account.mutations.authentication.utils import _get_new_csrf_token
from ..graphql.account.mutations.authentication.create_token import update_user_last_login_if_required
from ..graphql.site.dataloaders import get_site_promise


@method_decorator(csrf_exempt, name='dispatch')
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
                token = token_generator.make_token(user)
                params = urlencode({"email": user.email, "token": token})
                confirm_url = prepare_url(params, redirect_url)

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

