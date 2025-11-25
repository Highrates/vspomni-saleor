from django.core.management.base import BaseCommand
from django.utils import timezone

from ...models import Story, StoryItem


class Command(BaseCommand):
    help = "Creates test stories if they don't exist"

    def handle(self, *args, **options):
        stories_data = [
            {
                'title': 'Ароматы',
                'slug': 'aromaty',
                'image': '/images/image_faq_3.png',
                'order': 1,
                'items': [
                    '/images/image_faq_3.png',
                    '/images/image_faq_3.png',
                    '/images/image_faq_3.png',
                ]
            },
            {
                'title': 'Дом',
                'slug': 'dom',
                'image': '/images/image_faq_3.png',
                'order': 2,
                'items': [
                    '/images/image_faq_3.png',
                    '/images/image_faq_3.png',
                    '/images/image_faq_3.png',
                ]
            },
            {
                'title': 'Комната',
                'slug': 'komnata',
                'image': '/images/image_faq_3.png',
                'order': 3,
                'items': [
                    '/images/image_faq_3.png',
                    '/images/image_faq_3.png',
                    '/images/image_faq_3.png',
                ]
            },
            {
                'title': 'Подарки',
                'slug': 'podarki',
                'image': '/images/image_faq_3.png',
                'order': 4,
                'items': [
                    '/images/image_faq_3.png',
                    '/images/image_faq_3.png',
                    '/images/image_faq_3.png',
                ]
            },
        ]

        created_count = 0
        for story_data in stories_data:
            story, created = Story.objects.get_or_create(
                slug=story_data['slug'],
                defaults={
                    'title': story_data['title'],
                    'image': story_data['image'],
                    'order': story_data['order'],
                    'is_published': True,
                    'published_at': timezone.now(),
                }
            )
            
            if created:
                created_count += 1
                for idx, item_image in enumerate(story_data['items']):
                    StoryItem.objects.create(
                        story=story,
                        image=item_image,
                        order=idx + 1,
                    )
                self.stdout.write(
                    self.style.SUCCESS(f'Created story: {story.title}')
                )
            else:
                self.stdout.write(f'Story already exists: {story.title}')

        if created_count > 0:
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created {created_count} stories.')
            )
        else:
            self.stdout.write('All stories already exist.')

