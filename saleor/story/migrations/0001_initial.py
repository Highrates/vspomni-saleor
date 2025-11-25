# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Story',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('private_metadata', models.JSONField(blank=True, default=dict, encoder=None, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict, encoder=None, null=True)),
                ('title', models.CharField(max_length=250)),
                ('slug', models.SlugField(max_length=255, unique=True)),
                ('image', models.URLField(blank=True, help_text='Preview image URL', null=True)),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_published', models.BooleanField(db_default=False, default=False)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'Story',
                'verbose_name_plural': 'Stories',
                'ordering': ('order', 'created_at'),
            },
        ),
        migrations.CreateModel(
            name='StoryItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.URLField(help_text='Story image URL')),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('story', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='story.story')),
            ],
            options={
                'ordering': ('order', 'created_at'),
                'unique_together': {('story', 'order')},
            },
        ),
    ]

