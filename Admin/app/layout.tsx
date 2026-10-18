import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/open-sans/wght.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vspomni',
  description: 'Натуральная косметика Vspomni',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        {/* Fallback if main JS bundles never load (slow/broken TLS path). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=8000;setTimeout(function(){if(document.body.classList.contains('--js-ready'))return;document.getElementById('site-boot-loader')&&document.getElementById('site-boot-loader').remove();var l=document.querySelector('[data-site-loader]');l&&l.remove();document.body.classList.add('--js-ready');},t);})();`,
          }}
        />
      </body>
    </html>
  );
}
