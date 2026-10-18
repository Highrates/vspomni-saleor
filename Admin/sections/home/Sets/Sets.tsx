import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard/ProductCard';
import { toProductCardProps, type PublicProductCard } from '@/lib/publicCatalog';
import styles from './Sets.module.css';

const INTRO = (
  <>
    Наши продукты прекрасно сочетаются между собой, усиливая действие друг друга. Чтобы вам было
    удобно, мы собрали полные наборы ухода, учитывающие разные запросы кожи. В каждом наборе вы
    найдёте полноступенчатый уход от очищения до финального этапа защиты и восстановления.
    <span className={styles.introParagraph}>
      Покупать наборами не только удобно, но и выгодно: все товары в данной категории уже идут со
      скидкой, так что вы получаете полноценный ритуал ухода по более привлекательной цене.
    </span>
  </>
);

export function Sets({
  setImageUrl,
  product,
}: {
  setImageUrl: string;
  product: PublicProductCard;
}) {
  const card = toProductCardProps(product);

  return (
    <section className={styles.section} aria-labelledby="homepage-sets-title">
      <div className="padding-global">
        <h2 id="homepage-sets-title" className={styles.title}>
          Наборы
        </h2>
        <div className={styles.wrapper}>
          <div className={styles.left}>
            <p className={styles.intro}>{INTRO}</p>
            <Link href="/catalog" className={styles.moreLink}>
              Больше наборов →
            </Link>
          </div>
          <div className={styles.center}>
            <ProductCard {...card} />
          </div>
          <div className={styles.right}>
            <div className={styles.imageCircle}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.setImage} src={setImageUrl} alt="" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
