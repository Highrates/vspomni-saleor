'use client';

import { formatChoiceStarDate } from '@vspomni/catalog-constants';
import pn from './productNew.module.css';

export type ChoiceStarPreviewProps = {
  productName: string;
  price: number | null;
  /** Фото товара (плашка + fallback фона) */
  productImageUrl: string | null;
  starName: string;
  starDate: string;
  starImageUrl: string | null;
};

/** Миниатюра карточки «Выбор ⭐» как на главной. */
export function ChoiceStarPreview({
  productName,
  price,
  productImageUrl,
  starName,
  starDate,
  starImageUrl,
}: ChoiceStarPreviewProps) {
  const mainSrc = starImageUrl?.trim() || productImageUrl?.trim() || '';
  const thumbSrc = productImageUrl?.trim() || starImageUrl?.trim() || '';
  const usingProductFallback = !starImageUrl?.trim() && Boolean(productImageUrl?.trim());
  const caption = [starName.trim(), formatChoiceStarDate(starDate)]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className={pn.choicePreviewWrap}>
      <p className={pn.choicePreviewLabel}>Превью на главной</p>
      <div className={pn.choicePreviewCard}>
        <div className={pn.choicePreviewStage}>
          {mainSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={pn.choicePreviewHero} src={mainSrc} alt="" />
          ) : (
            <div className={pn.choicePreviewHeroEmpty}>Нет фото</div>
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
      {usingProductFallback ? (
        <p className={pn.choicePreviewWarn}>
          Нет фото знаменитости — на карточке будет фото товара
        </p>
      ) : null}
      {!caption && (starName || starDate || starImageUrl || productImageUrl) ? (
        <p className={pn.placementHint}>Подпись звезды появится после имени или даты</p>
      ) : null}
    </div>
  );
}
