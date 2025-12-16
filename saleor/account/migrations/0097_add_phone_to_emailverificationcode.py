# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0096_alter_user_language_code'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailVerificationCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(db_index=True, max_length=254)),
                ('code', models.CharField(db_index=True, max_length=6)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_used', models.BooleanField(default=False)),
                ('phone', models.CharField(blank=True, default='', max_length=20)),
            ],
            options={
                'verbose_name': 'Email verification code',
                'verbose_name_plural': 'Email verification codes',
            },
        ),
        migrations.AddIndex(
            model_name='emailverificationcode',
            index=models.Index(fields=['email', 'created_at'], name='account_ema_email_cr_idx'),
        ),
    ]

