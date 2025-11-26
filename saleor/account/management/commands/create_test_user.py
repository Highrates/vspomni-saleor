"""Management command to create a test user with confirmed email."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

User = get_user_model()


class Command(BaseCommand):
    help = "Create a test user with confirmed email for testing purposes"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            default="test@gmail.com",
            help="Email address for the test user (default: test@gmail.com)",
        )
        parser.add_argument(
            "--password",
            type=str,
            default="Admin123456",
            help="Password for the test user (default: Admin123456)",
        )
        parser.add_argument(
            "--confirm-existing",
            action="store_true",
            help="If user exists, confirm their email instead of creating new one",
        )

    def handle(self, *args, **options):
        email = options["email"].lower().strip()
        password = options["password"]
        confirm_existing = options["confirm_existing"]

        try:
            with transaction.atomic():
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "is_active": True,
                        "is_confirmed": True,
                    },
                )

                if created:
                    user.set_password(password)
                    user.is_active = True
                    user.is_confirmed = True
                    user.save(update_fields=["is_active", "is_confirmed"])
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Successfully created test user: {email}"
                        )
                    )
                else:
                    if confirm_existing:
                        user.set_password(password)
                        user.is_active = True
                        user.is_confirmed = True
                        user.save(update_fields=["is_active", "is_confirmed"])
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"Successfully confirmed existing user: {email}"
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                f"User {email} already exists. Use --confirm-existing to confirm their email."
                            )
                        )
                        return

                self.stdout.write(
                    self.style.SUCCESS(
                        f"User details:\n"
                        f"  Email: {user.email}\n"
                        f"  Password: {password}\n"
                        f"  Is Active: {user.is_active}\n"
                        f"  Is Confirmed: {user.is_confirmed}"
                    )
                )

        except Exception as e:
            raise CommandError(f"Error creating/confirming user: {str(e)}")

