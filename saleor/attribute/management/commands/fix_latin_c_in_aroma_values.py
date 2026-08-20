"""Исправляет латинскую «c» в значениях атрибута ароматов (cладкий → сладкий)."""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from ...models import AttributeValue


class Command(BaseCommand):
    help = "Replace latin 'c' with cyrillic 'с' in aroma attribute values (cladkii → сладкий)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show changes without saving",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        qs = AttributeValue.objects.filter(name__startswith="cладк")
        # также по известному slug из данных
        qs = qs | AttributeValue.objects.filter(slug="cladkii")
        qs = qs.distinct()

        if not qs.exists():
            self.stdout.write(self.style.WARNING("No matching AttributeValue rows found."))
            return

        for value in qs:
            old_name = value.name
            old_slug = value.slug
            new_name = old_name.replace("cладк", "сладк").replace("Cладк", "Сладк")
            # лат. c перед кириллицей в начале слова
            if new_name.startswith("c") and len(new_name) > 1:
                rest = new_name[1:]
                if rest and "\u0400" <= rest[0] <= "\u04FF":
                    new_name = "с" + rest
            new_slug = slugify(new_name, allow_unicode=True) or "sladkii"

            self.stdout.write(
                f"id={value.pk}: name {old_name!r} → {new_name!r}; "
                f"slug {old_slug!r} → {new_slug!r}"
            )
            if not dry_run:
                value.name = new_name
                value.slug = new_slug
                value.save(update_fields=["name", "slug"])

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — nothing saved."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Updated {qs.count()} value(s)."))
