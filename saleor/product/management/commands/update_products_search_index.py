import logging

from django.core.management.base import BaseCommand

from ...models import Product
from ...search import update_products_search_vector
from ....core.utils.batches import queryset_in_batches

logger = logging.getLogger(__name__)

PRODUCTS_BATCH_SIZE = 100


class Command(BaseCommand):
    help = "Updates search_vector for all products to enable search functionality."

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Update all products, not just those with search_index_dirty=True',
        )

    def handle(self, *args, **options):
        if options['all']:
            self.stdout.write('Updating search_vector for ALL products...')
            queryset = Product.objects.all()
        else:
            self.stdout.write('Updating search_vector for products with search_index_dirty=True...')
            queryset = Product.objects.filter(search_index_dirty=True)
        
        total_count = queryset.count()
        self.stdout.write(f'Found {total_count} products to update.')
        
        updated_count = 0
        for product_ids in queryset_in_batches(queryset, PRODUCTS_BATCH_SIZE):
            self.stdout.write(f'Updating products batch: {len(product_ids)} products...')
            update_products_search_vector(product_ids)
            updated_count += len(product_ids)
            self.stdout.write(f'Updated {updated_count}/{total_count} products.')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully updated search_vector for {updated_count} products.'
            )
        )

