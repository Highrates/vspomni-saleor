'use client';

import { formatChoiceStarDate } from '@vspomni/catalog-constants';
import { toRelativeMediaPath } from '@vspomni/media-path';
import pn from '@/app/(admin)/admin/catalog/products/productNew.module.css';

export type UnpackingReelPreviewProps = {
  productName: string;
  price: number | null;
  productImageUrl: string | null;
  captionName: string;
  captionDate: string;
  /** Object URL или серверный путь */
  videoSrc: string | null;
  posterSrc: string | null;
};

function mediaSrc(url: string | null | undefined): string {
  const t = (url ?? '').trim();
  if (!t) return '';
  if (t.startsWith('blob:') || t.startsWith('data:')) return t;
  return toRelativeMediaPath(t) || t;
}

/** Миниатюра карточки «Распаковка» как на главной. */
export function UnpackingReelPreview({
  productName,
  price,
  productImageUrl,
  captionName,
  captionDate,
  videoSrc,
  posterSrc,
}: UnpackingReelPreviewProps) {
  const video = mediaSrc(videoSrc);
  const poster = mediaSrc(posterSrc);
  const productImg = mediaSrc(productImageUrl);
  const thumbSrc = productImg || poster;
  const caption = [captionName.trim(), formatChoiceStarDate(captionDate)]
    .filter(Boolean)
    .join(' • ');
  const missingPoster = Boolean(video) && !poster;

  return (
    <div className={pn.choicePreviewWrap}>
      <p className={pn.choicePreviewLabel}>Превью на главной</p>
      <div className={pn.choicePreviewCard}>
        <div className={pn.choicePreviewStage}>
          {video ? (
            <video
              className={pn.choicePreviewHero}
              src={video}
              poster={poster || undefined}
              muted
              playsInline
              preload="metadata"
            />
          ) : poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={pn.choicePreviewHero} src={poster} alt="" />
          ) : (
            <div className={pn.choicePreviewHeroEmpty}>Нет видео</div>
          )}
          {caption ? <p className={pn.choicePreviewCaption}>{caption}</p> : null}
          <div className={pn.choicePreviewPlaque}>
            <div className={pn.choicePreviewThumb}>
              {thumbSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbSrc} alt="" />
              ) : null}
            </div>
            <div className={pn.choicePreviewPlaqueText}>
              <span className={pn.choicePreviewProductName}>
                {productName.trim() || 'Название товара'}
              </span>
              <span className={pn.choicePreviewPrice}>
                {price != null && Number.isFinite(price) ? `${price} ₽` : '— ₽'}
              </span>
            </div>
            <div className={pn.choicePreviewCartFake} aria-hidden />
          </div>
        </div>
      </div>
      {missingPoster ? (
        <p className={pn.choicePreviewWarn}>
          Нет постера — для LCP на главной нужен кадр-обложка
        </p>
      ) : null}
    </div>
  );
}
