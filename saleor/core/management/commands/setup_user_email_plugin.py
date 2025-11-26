import os

import dj_email_url
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.module_loading import import_string

from ....plugins.models import PluginConfiguration


class Command(BaseCommand):
    help = "Setup UserEmailPlugin configuration from USER_EMAIL_URL"

    def handle(self, *args, **options):
        user_email_path = "saleor.plugins.user_email.plugin.UserEmailPlugin"
        
        if user_email_path not in settings.PLUGINS:
            self.stdout.write(
                self.style.ERROR(
                    f"Plugin {user_email_path} is not in settings.PLUGINS"
                )
            )
            return

        email_url = os.environ.get("USER_EMAIL_URL", getattr(settings, "EMAIL_URL", None))

        if not email_url:
            self.stdout.write(
                self.style.WARNING(
                    "USER_EMAIL_URL or EMAIL_URL not found. Creating plugin with default config."
                )
            )
            email_config = {}
        else:
            email_config = dj_email_url.parse(email_url)
            email_config = {
                "host": email_config.get("EMAIL_HOST", ""),
                "port": email_config.get("EMAIL_PORT", ""),
                "username": email_config.get("EMAIL_HOST_USER", ""),
                "password": email_config.get("EMAIL_HOST_PASSWORD", ""),
                "sender_address": getattr(settings, "DEFAULT_FROM_EMAIL", ""),
                "use_tls": email_config.get("EMAIL_USE_TLS", False),
                "use_ssl": email_config.get("EMAIL_USE_SSL", False),
            }

        try:
            UserEmail = import_string(user_email_path)
        except ImportError as e:
            self.stdout.write(
                self.style.ERROR(f"Failed to import plugin: {e}")
            )
            return

        configuration = UserEmail.DEFAULT_CONFIGURATION.copy()
        
        for configuration_field in configuration:
            config_name = configuration_field["name"]
            if config_name in email_config:
                configuration_field["value"] = email_config[config_name]

        from ....channel.models import Channel
        
        channels = Channel.objects.all()
        
        if not channels.exists():
            self.stdout.write(
                self.style.WARNING("No channels found. Creating global plugin configuration.")
            )
            plugin_configuration, created = PluginConfiguration.objects.get_or_create(
                identifier=UserEmail.PLUGIN_ID,
                channel=None,
                defaults={"active": True, "configuration": configuration, "name": "User emails"},
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ Created UserEmailPlugin configuration (ID: {UserEmail.PLUGIN_ID})"
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ UserEmailPlugin already exists (ID: {UserEmail.PLUGIN_ID})"
                    )
                )
                # Обновить конфигурацию если она изменилась
                plugin_configuration.configuration = configuration
                plugin_configuration.active = True
                plugin_configuration.save()
                self.stdout.write(
                    self.style.SUCCESS("✅ Updated and activated UserEmailPlugin")
                )
        else:
            for channel in channels:
                plugin_configuration, created = PluginConfiguration.objects.get_or_create(
                    identifier=UserEmail.PLUGIN_ID,
                    channel=channel,
                    defaults={"active": True, "configuration": configuration, "name": "User emails"},
                )
                
                if created:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"✅ Created UserEmailPlugin for channel: {channel.slug} (ID: {UserEmail.PLUGIN_ID})"
                        )
                    )
                else:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"✅ UserEmailPlugin already exists for channel: {channel.slug}"
                        )
                    )
                    
                    # Обновить конфигурацию если она изменилась
                    plugin_configuration.configuration = configuration
                    plugin_configuration.active = True
                    plugin_configuration.save()
                    self.stdout.write(
                        self.style.SUCCESS(f"✅ Updated and activated UserEmailPlugin for channel: {channel.slug}")
                    )

        if email_config:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✅ SMTP configured: {email_config.get('host')}:{email_config.get('port')}"
                )
            )

