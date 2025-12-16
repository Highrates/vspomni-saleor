# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0096_alter_user_language_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='emailverificationcode',
            name='phone',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
    ]

