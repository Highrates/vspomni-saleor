import Link from 'next/link';
import { ProductCard, type ProductCardProps } from '@/components/ProductCard/ProductCard';
import styles from './Recommendations.module.css';

export function Recommendations({
  id,
  title,
  items,
  moreHref,
  moreLabel = 'Все →',
}: {
  id?: string;
  title?: string;
  items: ProductCardProps[];
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <section id={id} className={styles.section} aria-label={title ?? 'Товары'}>
      <div className="padding-global">
        {title ? (
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{title}</h2>
            {moreHref ? (
              <Link href={moreHref} className={styles.moreLink}>
                {moreLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className={styles.grid}>
          {items.map((item) => (
            <ProductCard key={item.slug} {...item} />
          ))}
        </div>
        {moreHref && !title ? (
          <div className={styles.footerMore}>
            <Link href={moreHref} className={styles.moreLink}>
              {moreLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
