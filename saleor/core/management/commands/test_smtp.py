import os
import socket
import sys
import time
from contextlib import contextmanager

import dj_email_url
from django.core.mail import send_mail
from django.core.mail.backends.smtp import EmailBackend
from django.core.management.base import BaseCommand


@contextmanager
def timeout_context(seconds):
    """Контекстный менеджер для таймаута"""
    import signal
    
    def timeout_handler(signum, frame):
        raise TimeoutError(f"Operation timed out after {seconds} seconds")
    
    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)


class Command(BaseCommand):
    help = "Test SMTP connection with timeout and diagnostics"

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout',
            type=int,
            default=30,
            help='Timeout in seconds (default: 30)',
        )
        parser.add_argument(
            '--test-url',
            type=str,
            help='Test with custom URL instead of USER_EMAIL_URL',
        )

    def handle(self, *args, **options):
        timeout = options['timeout']
        test_url = options.get('test_url')
        
        self.stdout.write("="*60)
        self.stdout.write("🔧 SMTP Connection Test")
        self.stdout.write("="*60)
        
        email_url = test_url or os.environ.get("USER_EMAIL_URL")
        if not email_url:
            self.stdout.write(
                self.style.ERROR("❌ USER_EMAIL_URL not found in environment")
            )
            return
        
        self.stdout.write(f"\n📝 Testing URL: {email_url[:80]}...")
        
        # Parse URL
        try:
            config = dj_email_url.parse(email_url)
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Failed to parse URL: {e}")
            )
            return
        
        host = config.get('EMAIL_HOST')
        port = config.get('EMAIL_PORT')
        use_tls = config.get('EMAIL_USE_TLS', False)
        use_ssl = config.get('EMAIL_USE_SSL', False)
        
        self.stdout.write(f"\n📊 Configuration:")
        self.stdout.write(f"   Host: {host}")
        self.stdout.write(f"   Port: {port}")
        self.stdout.write(f"   User: {config.get('EMAIL_HOST_USER')}")
        self.stdout.write(f"   TLS: {use_tls}")
        self.stdout.write(f"   SSL: {use_ssl}")
        
        # Test different URL formats if TLS/SSL is not set
        if not use_tls and not use_ssl:
            self.stdout.write(f"\n⚠️  TLS/SSL not detected in URL!")
            self.stdout.write(f"   Testing alternative URL formats...")
            self._test_url_formats(host, port, config.get('EMAIL_HOST_USER'), config.get('EMAIL_HOST_PASSWORD'))
        
        # Check host connectivity
        self.stdout.write(f"\n🔍 Checking host connectivity...")
        try:
            sock = socket.create_connection((host, port), timeout=5)
            sock.close()
            self.stdout.write(
                self.style.SUCCESS(f"✅ Host {host}:{port} is reachable")
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Cannot reach {host}:{port}: {e}")
            )
            return
        
        # Auto-fix TLS/SSL based on port
        if port == 587 and not use_tls and not use_ssl:
            self.stdout.write(
                self.style.WARNING("⚠️  Port 587 usually requires TLS. Enabling TLS...")
            )
            use_tls = True
        elif port == 465 and not use_ssl and not use_tls:
            self.stdout.write(
                self.style.WARNING("⚠️  Port 465 usually requires SSL. Enabling SSL...")
            )
            use_ssl = True
        
        # Create backend
        backend = EmailBackend(
            host=host,
            port=port,
            username=config.get('EMAIL_HOST_USER'),
            password=config.get('EMAIL_HOST_PASSWORD'),
            use_ssl=use_ssl,
            use_tls=use_tls,
            timeout=10,
        )
        
        # Test sending
        test_email = os.environ.get('DEFAULT_FROM_EMAIL', config.get('EMAIL_HOST_USER', 'test@example.com'))
        self.stdout.write(f"\n📤 Sending test email to {test_email} (timeout: {timeout}s)...")
        
        try:
            if sys.platform != 'win32':
                with timeout_context(timeout):
                    result = send_mail(
                        'Test Email from Saleor',
                        'This is a test message from Saleor SMTP test command.',
                        test_email,
                        [test_email],
                        connection=backend,
                        fail_silently=False,
                    )
            else:
                # Windows fallback
                import threading
                result_container = [None]
                exception_container = [None]
                
                def send():
                    try:
                        result_container[0] = send_mail(
                            'Test Email from Saleor',
                            'This is a test message from Saleor SMTP test command.',
                            test_email,
                            [test_email],
                            connection=backend,
                            fail_silently=False,
                        )
                    except Exception as e:
                        exception_container[0] = e
                
                thread = threading.Thread(target=send)
                thread.daemon = True
                thread.start()
                thread.join(timeout)
                
                if thread.is_alive():
                    self.stdout.write(
                        self.style.ERROR(f"❌ Operation timed out after {timeout} seconds")
                    )
                    self._suggest_fixes(host, port, use_tls, use_ssl)
                    return
                
                if exception_container[0]:
                    raise exception_container[0]
                
                result = result_container[0]
            
            if result:
                self.stdout.write(
                    self.style.SUCCESS("✅ Test email sent successfully!")
                )
            else:
                self.stdout.write(
                    self.style.ERROR("❌ Failed to send email (result: None)")
                )
                
        except TimeoutError:
            self.stdout.write(
                self.style.ERROR(f"❌ Operation timed out after {timeout} seconds")
            )
            self._suggest_fixes(host, port, use_tls, use_ssl)
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Error: {type(e).__name__}: {e}")
            )
            self._suggest_fixes(host, port, use_tls, use_ssl)
    
    def _test_url_formats(self, host, port, username, password):
        """Test different URL formats to find working one"""
        test_formats = []
        
        if port == 587:
            test_formats = [
                f"smtp://{username}:{password}@{host}:{port}/?tls=1",
                f"smtp://{username}:{password}@{host}:{port}/?use_tls=1",
                f"smtp://{username}:{password}@{host}:{port}/?tls=True",
            ]
        elif port == 465:
            test_formats = [
                f"smtp://{username}:{password}@{host}:{port}/?ssl=1",
                f"smtp://{username}:{password}@{host}:{port}/?use_ssl=1",
                f"smtp://{username}:{password}@{host}:{port}/?ssl=True",
            ]
        
        for test_url in test_formats:
            try:
                test_config = dj_email_url.parse(test_url)
                test_tls = test_config.get('EMAIL_USE_TLS', False)
                test_ssl = test_config.get('EMAIL_USE_SSL', False)
                if test_tls or test_ssl:
                    self.stdout.write(
                        self.style.SUCCESS(f"   ✅ Working format: {test_url[:60]}...")
                    )
                    self.stdout.write(f"      TLS: {test_tls}, SSL: {test_ssl}")
                    break
            except Exception as e:
                self.stdout.write(f"   ❌ Format failed: {e}")
    
    def _suggest_fixes(self, host, port, use_tls, use_ssl):
        """Suggest fixes based on configuration"""
        self.stdout.write("\n" + "="*60)
        self.stdout.write("💡 Suggestions")
        self.stdout.write("="*60)
        
        if 'unisender' in host.lower():
            self.stdout.write("\nFor Unisender, try:")
            self.stdout.write("1. With TLS (port 587):")
            self.stdout.write("   USER_EMAIL_URL=smtp://user:pass@smtp.go1.unisender.ru:587/?tls=1")
            self.stdout.write("   or")
            self.stdout.write("   USER_EMAIL_URL=smtp://user:pass@smtp.go2.unisender.ru:587/?tls=1")
            self.stdout.write("\n2. With SSL (port 465):")
            self.stdout.write("   USER_EMAIL_URL=smtp://user:pass@smtp.go1.unisender.ru:465/?ssl=1")
        
        if port == 587 and not use_tls:
            self.stdout.write(f"\n⚠️  Port {port} usually requires TLS.")
            self.stdout.write("   Add to URL: ?tls=1 or ?use_tls=1")
        
        if port == 465 and not use_ssl:
            self.stdout.write(f"\n⚠️  Port {465} usually requires SSL.")
            self.stdout.write("   Add to URL: ?ssl=1 or ?use_ssl=1")
        
        self.stdout.write("\n📝 Note: dj_email_url uses numeric values:")
        self.stdout.write("   - ?tls=1 (not tls=True)")
        self.stdout.write("   - ?ssl=1 (not ssl=True)")

