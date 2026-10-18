import type { PublicFaqItem } from '@/lib/faqPublicServer';
import { faqAnswerPlainText } from '@/lib/faqAnswerHtml';

/** JSON-LD FAQPage для SEO. */
export function FaqJsonLd({ items }: { items: PublicFaqItem[] }) {
  if (!items.length) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqAnswerPlainText(it.answer),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
      }}
    />
  );
}
