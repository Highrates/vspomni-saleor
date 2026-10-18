import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import styles from './NotFound.module.css';

export const metadata: Metadata = {
  title: 'Страница не найдена — Jcos',
};

export default function NotFound() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.home}>
        Вернуться на главную
      </Link>

      <div className={styles.code} aria-hidden>
        <span className={styles.digit}>4</span>
        <span className={styles.dropWrap}>
          <Image
            src="/images/404.png"
            alt=""
            width={420}
            height={560}
            priority
            className={styles.drop}
          />
        </span>
        <span className={styles.digit}>4</span>
      </div>

      <h1 className={styles.message}>Такой страницы нет</h1>
    </main>
  );
}
