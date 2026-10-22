'use client'

import Link from 'next/link'
import Image from 'next/image'
import wbIcon from '@/assets/icons/wb.svg'
import ozonIcon from '@/assets/icons/ozon.svg'
import yamIcon from '@/assets/icons/yam.svg'
import zyaIcon from '@/assets/icons/zya.svg'
import rgIcon from '@/assets/icons/rg.svg'
import laIcon from '@/assets/icons/la.svg'
import { SITE_PRIMARY_NAV } from '@/lib/seo/siteNav'

const marketplaceIconClass =
  'block size-9 shrink-0 rounded-sm transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black'

const footerNavLinkClass =
  'text-sm md:text-base text-black font-medium hover:opacity-80 transition-opacity'

export default function Footer() {
  return (
    <footer className="flex flex-col container">
      <div className="w-full border-t border-bordergrey flex flex-col gap-8 md:flex-row md:items-start md:justify-start md:gap-10 lg:gap-14 pt-6 md:pt-10 pb-8 md:pb-13.25">
        <div className="text-left min-w-0 shrink-0">
          <p className="text-2xl md:text-[32px] font-bold mb-4 md:mb-6">
            ВСПОМНИ.
          </p>
          <div className="flex flex-row gap-2 items-center justify-start">
            <Image
              src="/telegram.svg"
              alt="telegram link"
              width={17}
              height={17}
            />
            <Link
              href="https://t.me/vspomni_corp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm md:text-base text-black font-medium"
            >
              Связаться с нами
            </Link>
          </div>
          <div className="mt-4 inline-flex justify-start items-center gap-2">
            <Link
              href="https://www.wildberries.ru/brands/312306051-vspomni"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Wildberries"
              className={marketplaceIconClass}
            >
              <Image src={wbIcon} alt="" width={36} height={36} unoptimized />
            </Link>
            <Link
              href="https://www.ozon.ru/seller/vspomni-3814167/products/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ozon"
              className={marketplaceIconClass}
            >
              <Image src={ozonIcon} alt="" width={36} height={36} unoptimized />
            </Link>
            <Link
              href="https://market.yandex.ru/business--vspomni/216511078"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Яндекс Маркет"
              className={marketplaceIconClass}
            >
              <Image src={yamIcon} alt="" width={36} height={36} unoptimized />
            </Link>
            <Link
              href="https://goldapple.ru/brands/vspomni"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Золотое яблоко"
              className={marketplaceIconClass}
            >
              <Image src={zyaIcon} alt="" width={36} height={36} unoptimized />
            </Link>
            <Link
              href="https://rivegauche.ru/brands/vspomni"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Рив Гош"
              className={marketplaceIconClass}
            >
              <Image src={rgIcon} alt="" width={36} height={36} unoptimized />
            </Link>
            <Link
              href="https://www.lamoda.ru/b/38470/brand-vspomni/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Lamoda"
              className={marketplaceIconClass}
            >
              <Image src={laIcon} alt="" width={36} height={36} unoptimized />
            </Link>
          </div>
        </div>

        <nav
          className="text-left flex flex-col gap-3 md:gap-4 items-start min-w-0 shrink-0"
          aria-label="Каталог"
        >
          {SITE_PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={footerNavLinkClass}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="text-left flex flex-col gap-3 md:gap-4 items-start min-w-0 shrink-0">
          <Link
            href="https://t.me/vspomni_corp"
            target="_blank"
            rel="noopener noreferrer"
            className={footerNavLinkClass}
          >
            Служба заботы
          </Link>
          <Link href="/article/korporativnye-podarki-2" className={footerNavLinkClass}>
            Корпоративные подарки
          </Link>
          <Link
            href="https://t.me/vspomni_corp"
            target="_blank"
            rel="noopener noreferrer"
            className={footerNavLinkClass}
          >
            Оптовые продажи
          </Link>
          <Link href="/article/istoriia-sozdaniia" className={footerNavLinkClass}>
            История создания
          </Link>
          <Link href="/news" className={footerNavLinkClass}>
            Новости
          </Link>
          <Link href="/partners" className={footerNavLinkClass}>
            Партнёры
          </Link>
        </div>
      </div>

      {/* Footer Bottom — нижняя часть за чертой */}
      <div className="w-full border-t border-bordergrey py-4 md:py-3.5">
        <div className="flex flex-col md:flex-row items-start justify-start gap-2 md:gap-4">
          <div className="text-left text-xs md:text-sm text-black select-none">
            © {new Date().getFullYear()} ВСПОМНИ. Все права защищены.
          </div>
          <div className="flex flex-row flex-wrap items-center text-xs md:text-sm gap-2">
            <Link href="/" className="text-textgrey hover:text-black">
              Условия использования
            </Link>
            <span className="text-textgrey select-none">·</span>
            <Link href="/article/privacy-policy" className="text-textgrey hover:text-black">
              Политика конфиденциальности
            </Link>
            <span className="text-textgrey select-none">·</span>
            <Link href="/sitemap.xml" className="text-textgrey hover:text-black">
              Карта сайта
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
