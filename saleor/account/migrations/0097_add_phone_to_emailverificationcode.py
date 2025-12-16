# Generated manually

from django.db import migrations, models, connection


def create_table_if_not_exists(apps, schema_editor):
    """Create EmailVerificationCode table if it doesn't exist, otherwise just add phone field."""
    db_table = 'account_emailverificationcode'
    
    with connection.cursor() as cursor:
        # Check if table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = %s
            );
        """, [db_table])
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            # Create the table
            cursor.execute("""
                CREATE TABLE account_emailverificationcode (
                    id BIGSERIAL PRIMARY KEY,
                    email VARCHAR(254) NOT NULL,
                    code VARCHAR(6) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    is_used BOOLEAN NOT NULL DEFAULT FALSE,
                    phone VARCHAR(20) NOT NULL DEFAULT ''
                );
            """)
            # Create indexes
            cursor.execute("CREATE INDEX account_emailverificationcode_email_idx ON account_emailverificationcode(email);")
            cursor.execute("CREATE INDEX account_emailverificationcode_code_idx ON account_emailverificationcode(code);")
            cursor.execute("CREATE INDEX account_ema_email_cr_idx ON account_emailverificationcode(email, created_at);")
        else:
            # Table exists, check if phone column exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = %s 
                    AND column_name = 'phone'
                );
            """, [db_table])
            phone_exists = cursor.fetchone()[0]
            
            if not phone_exists:
                # Add phone column
                cursor.execute("""
                    ALTER TABLE account_emailverificationcode 
                    ADD COLUMN phone VARCHAR(20) NOT NULL DEFAULT '';
                """)


def reverse_migration(apps, schema_editor):
    """Reverse migration - remove phone field if it exists."""
    db_table = 'account_emailverificationcode'
    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = %s 
                AND column_name = 'phone'
            );
        """, [db_table])
        phone_exists = cursor.fetchone()[0]
        
        if phone_exists:
            cursor.execute("ALTER TABLE account_emailverificationcode DROP COLUMN phone;")


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0096_alter_user_language_code'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(create_table_if_not_exists, reverse_migration),
            ],
            state_operations=[
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
            ],
        ),
    ]

