from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.views import serve
from django.urls import re_path
from django.views.decorators.csrf import csrf_exempt

from .core.views import jwks
from .graphql.api import backend, schema
from .graphql.views import GraphQLView
from .plugins.views import (
    handle_global_plugin_webhook,
    handle_plugin_per_channel_webhook,
    handle_plugin_webhook,
)
from .product.views import digital_product
from .thumbnail.views import handle_thumbnail
from .account.rest_views import (
    AuthLoginView,
    AuthSignupView,
    AuthMeView,
    SendRegistrationEmailView,
)
from .checkout.rest_views import CreateCheckoutWithoutStockCheckView

urlpatterns = [
    re_path(
        r"^graphql/$",
        csrf_exempt(GraphQLView.as_view(backend=backend, schema=schema)),
        name="api",
    ),
    re_path(
        r"^digital-download/(?P<token>[0-9A-Za-z_\-]+)/$",
        digital_product,
        name="digital-product",
    ),
    re_path(
        r"^plugins/channel/(?P<channel_slug>[.0-9A-Za-z_\-]+)/"
        r"(?P<plugin_id>[.0-9A-Za-z_\-]+)/",
        handle_plugin_per_channel_webhook,
        name="plugins-per-channel",
    ),
    re_path(
        r"^plugins/global/(?P<plugin_id>[.0-9A-Za-z_\-]+)/",
        handle_global_plugin_webhook,
        name="plugins-global",
    ),
    re_path(
        r"^plugins/(?P<plugin_id>[.0-9A-Za-z_\-]+)/",
        handle_plugin_webhook,
        name="plugins",
    ),
    re_path(
        (
            r"^thumbnail/(?P<instance_id>[.0-9A-Za-z_=\-]+)/(?P<size>\d+)/"
            r"(?:(?P<format>[a-zA-Z]+)/)?"
        ),
        handle_thumbnail,
        name="thumbnail",
    ),
    re_path(r"^\.well-known/jwks.json$", jwks, name="jwks"),
    re_path(r"^auth/login/$", AuthLoginView.as_view(), name="auth-login"),
    re_path(r"^auth/signup/$", AuthSignupView.as_view(), name="auth-signup"),
    re_path(r"^auth/me/$", AuthMeView.as_view(), name="auth-me"),
    re_path(
        r"^auth/send-registration-email/$",
        SendRegistrationEmailView.as_view(),
        name="auth-send-registration-email",
    ),
    re_path(
        r"^api/checkout/create-without-stock-check/$",
        CreateCheckoutWithoutStockCheckView.as_view(),
        name="checkout-create-without-stock-check",
    ),
    # Альтернативный паттерн без /api/ префикса для совместимости с продакшн конфигурацией
    re_path(
        r"^checkout/create-without-stock-check/$",
        CreateCheckoutWithoutStockCheckView.as_view(),
        name="checkout-create-without-stock-check-alt",
    ),
]

if settings.DEBUG:
    from .core import views

    urlpatterns += static("/media/", document_root=settings.MEDIA_ROOT) + [
        re_path(r"^static/(?P<path>.*)$", serve),
        re_path(r"^$", views.home, name="home"),
    ]
