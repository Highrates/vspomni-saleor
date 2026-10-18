import Link from 'next/link';
import styles from './FeaturedCollections.module.css';

export type FeaturedCollectionItem = {
  slug: string;
  name: string;
  description: string;
  /** Превью продукта (левая колонка) */
  productPreview?: string | null;
  /** Lifestyle / обложка (правая колонка) */
  lifestyleImage?: string | null;
  href?: string;
};

export type FeaturedCollectionsProps = {
  items: FeaturedCollectionItem[];
};

const FALLBACK_DESCRIPTION =
  'Коллекция представлена в нашем каталоге. Перейдите на страницу, чтобы увидеть ассортимент.';

function FeaturedCollectionBlock({ item }: { item: FeaturedCollectionItem }) {
  const href = item.href ?? `/catalog?collection=${encodeURIComponent(item.slug)}`;

  return (
    <section className={styles.section} aria-label={item.name}>
      <div className={styles.split}>
        <div className={styles.infoCol}>
          <div className={styles.infoPad}>
            <Link href={href} className={styles.infoLink}>
              <h3 className={styles.brandName}>{item.name}</h3>
              <div className={styles.productPreviewWrap}>
                {item.productPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.productPreview}
                    src={item.productPreview}
                    alt=""
                    width={640}
                    height={480}
                    decoding="async"
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.productPreviewPlaceholder} aria-hidden />
                )}
              </div>
              <p className={styles.description}>
                {item.description.trim() || FALLBACK_DESCRIPTION}
              </p>
              <span className={styles.moreLink}>Подробнее →</span>
            </Link>
          </div>
        </div>

        <div className={styles.lifestyleCol}>
          <Link href={href} className={styles.lifestyleLink} tabIndex={-1}>
            {item.lifestyleImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.lifestyleImage}
                src={item.lifestyleImage}
                alt=""
                width={960}
                height={720}
                decoding="async"
                loading="lazy"
              />
            ) : (
              <span className={styles.lifestylePlaceholder} aria-hidden />
            )}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function FeaturedCollections({ items }: FeaturedCollectionsProps) {
  if (!items?.length) return null;
  return (
    <>
      {items.map((item) => (
        <FeaturedCollectionBlock key={item.slug} item={item} />
      ))}
    </>
  );
}
