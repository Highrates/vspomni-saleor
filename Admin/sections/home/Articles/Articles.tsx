import Link from 'next/link';
import styles from './Articles.module.css';

export type ArticleListItem = {
  slug: string;
  title: string;
  imageUrl?: string | null;
};

export type ArticlesProps = {
  featured: ArticleListItem;
  items: ArticleListItem[];
  categories?: { slug: string; label: string }[];
  allHref?: string;
  /** Правая колонка — бренд/lifestyle (рядом с серой подложкой) */
  sideImageUrl?: string | null;
};

function ReadLink() {
  return <span className={styles.readLink}>Читать →</span>;
}

export function Articles({
  featured,
  items,
  categories = [],
  allHref = '/blog',
  sideImageUrl = '/images/home/Articles-side.jpg',
}: ArticlesProps) {
  return (
    <section className={styles.section} aria-label="Статьи">
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.inner}>
            <div className={styles.grid}>
              <article className={styles.featured}>
                <Link href={`/blog/${featured.slug}`} className={styles.featuredLink}>
                  <span className={styles.featuredCover}>
                    {featured.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={featured.imageUrl} alt="" className={styles.coverImg} />
                    ) : (
                      <span className={styles.coverPlaceholder} aria-hidden />
                    )}
                  </span>
                  <span className={styles.featuredTitle}>{featured.title}</span>
                  <ReadLink />
                </Link>
              </article>

              <div className={styles.middle}>
                <div className={styles.middleHead}>
                  {categories.length > 0 ? (
                    <nav className={styles.categories} aria-label="Категории статей">
                  {categories.slice(0, 4).map((c) => (
                    <Link
                      key={c.slug}
                      href={`/blog?category=${encodeURIComponent(c.slug)}`}
                      className={styles.category}
                    >
                      {c.label}
                    </Link>
                  ))}
                  {categories.length > 4 ? (
                    <Link href={allHref} className={styles.category}>
                      Ещё
                    </Link>
                  ) : null}
                    </nav>
                  ) : (
                    <span />
                  )}
                  <Link href={allHref} className={styles.allLink}>
                    Все →
                  </Link>
                </div>

                <ul className={styles.list}>
                  {items.map((item) => (
                    <li key={item.slug} className={styles.listItem}>
                      <Link href={`/blog/${item.slug}`} className={styles.listLink}>
                        <span className={styles.thumb}>
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" className={styles.coverImg} />
                          ) : (
                            <span className={styles.coverPlaceholder} aria-hidden />
                          )}
                        </span>
                        <span className={styles.listCopy}>
                          <span className={styles.listTitle}>{item.title}</span>
                          <ReadLink />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.side}>
          {sideImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sideImageUrl} alt="" className={styles.sideImg} />
          ) : (
            <span className={styles.sidePlaceholder} aria-hidden />
          )}
        </div>
      </div>
    </section>
  );
}
