#!/bin/sh
# Добавляет Yandex OAuth плагин в BUILTIN_PLUGINS при старте (если ещё не добавлен).
# Так плагин не слетает при пересборке образа.

SETTINGS="/app/saleor/settings.py"
MARK="yandex_oauth.plugin.YandexOAuthPlugin"

if ! grep -q "$MARK" "$SETTINGS"; then
  sed -i '/"saleor.plugins.openid_connect.plugin.OpenIDConnectPlugin",/a\
    "saleor.plugins.yandex_oauth.plugin.YandexOAuthPlugin",' "$SETTINGS"
fi

exec /app/docker-entrypoint.sh "$@"
