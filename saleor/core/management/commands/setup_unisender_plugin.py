"""
Django management command to setup UniSender Email Plugin
"""
import os

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.module_loading import import_string

from ....plugins.models import PluginConfiguration


class Command(BaseCommand):
    help = "Setup UniSenderEmailPlugin configuration from UNISENDER_API_KEY"

    def handle(self, *args, **options):
        plugin_path = "saleor.plugins.unisender.plugin.UnisenderEmailPlugin"
        
        if plugin_path not in settings.PLUGINS:
            self.stdout.write(
                self.style.ERROR(
                    f"Plugin {plugin_path} is not in settings.PLUGINS"
                )
            )
            return

        api_key = os.environ.get("UNISENDER_API_KEY", "")
        sender_address = getattr(settings, "DEFAULT_FROM_EMAIL", "")
        sender_name = os.environ.get("UNISENDER_SENDER_NAME", "")

        if not api_key:
            self.stdout.write(
                self.style.WARNING(
                    "UNISENDER_API_KEY not found in environment. Creating plugin with empty API key."
                )
            )

        if not sender_address:
            self.stdout.write(
                self.style.WARNING(
                    "DEFAULT_FROM_EMAIL not set. Please set it in settings or .env"
                )
            )

        try:
            UnisenderPlugin = import_string(plugin_path)
        except ImportError as e:
            self.stdout.write(
                self.style.ERROR(f"Failed to import plugin: {e}")
            )
            return

        configuration = UnisenderPlugin.DEFAULT_CONFIGURATION.copy()
        
        # Update configuration with values from environment
        for config_item in configuration:
            if config_item["name"] == "api_key":
                config_item["value"] = api_key
            elif config_item["name"] == "sender_address":
                config_item["value"] = sender_address
            elif config_item["name"] == "sender_name":
                config_item["value"] = sender_name

        from ....channel.models import Channel
        
        channels = Channel.objects.all()
        
        if not channels.exists():
            self.stdout.write(
                self.style.WARNING("No channels found. Creating global plugin configuration.")
            )
            plugin_configuration, created = PluginConfiguration.objects.get_or_create(
                identifier=UnisenderPlugin.PLUGIN_ID,
                channel=None,
                defaults={"active": True, "configuration": configuration, "name": "UniSender Email (API)"},
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ Created UniSenderEmailPlugin configuration (ID: {UnisenderPlugin.PLUGIN_ID})"
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ UniSenderEmailPlugin already exists (ID: {UnisenderPlugin.PLUGIN_ID})"
                    )
                )
                plugin_configuration.configuration = configuration
                plugin_configuration.active = True
                plugin_configuration.save()
                self.stdout.write(
                    self.style.SUCCESS("✅ Updated and activated UniSenderEmailPlugin")
                )
        else:
            for channel in channels:
                plugin_configuration, created = PluginConfiguration.objects.get_or_create(
                    identifier=UnisenderPlugin.PLUGIN_ID,
                    channel=channel,
                    defaults={"active": True, "configuration": configuration, "name": "UniSender Email (API)"},
                )
                
                if created:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"✅ Created UniSenderEmailPlugin for channel: {channel.slug} (ID: {UnisenderPlugin.PLUGIN_ID})"
                        )
                    )
                else:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"✅ UniSenderEmailPlugin already exists for channel: {channel.slug}"
                        )
                    )
                    
                    plugin_configuration.configuration = configuration
                    plugin_configuration.active = True
                    plugin_configuration.save()
                    self.stdout.write(
                        self.style.SUCCESS(f"✅ Updated and activated UniSenderEmailPlugin for channel: {channel.slug}")
                    )

        if api_key:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✅ UniSender API configured: API Key set, Sender: {sender_address or 'Not set'}"
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "⚠️  UNISENDER_API_KEY not set. Please set it in .env and run this command again."
                )
            )

