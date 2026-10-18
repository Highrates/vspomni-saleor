'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAccordion } from '@/components/admin/AdminAccordion/AdminAccordion';
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminPillChip, AdminPillChipList } from '@/components/AdminPillChip/AdminPillChip';
import { AdminRichField } from '@/components/admin/AdminRichField/AdminRichField';
import { AdminSelect, AdminTextArea, AdminTextField } from '@/components/AdminTextField/AdminTextField';
import { AdminConfirmDialog } from '@/components/admin/AdminModal/AdminConfirmDialog';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import type {
  AdminCatalogTag,
  AdminCategory,
  AdminProduct,
  AdminVariant,
} from '@/lib/adminCatalogTypes';
import { adminBackendListAllPages } from '@/lib/adminListAll';
import { revalidateCatalogStorefront } from '@/lib/revalidateCatalogStorefront';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import { ProductGalleryEditor, type GalleryImage } from './ProductGalleryEditor';
import pn from './productNew.module.css';

type PickRow = { id: string; name: string };

function categoryOptionLabel(c: AdminCategory): string {
  if (c.parent?.name) return `${c.parent.name} → ${c.name}`;
  return c.name;
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProductFormClient({ productId }: { productId?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = Boolean(productId);

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [catalogTags, setCatalogTags] = useState<AdminCatalogTag[]>([]);
  const [collections, setCollections] = useState<PickRow[]>([]);
  const [productSets, setProductSets] = useState<PickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [pageShortDescriptionHtml, setPageShortDescriptionHtml] = useState('');
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [actionEffectHtml, setActionEffectHtml] = useState('');
  const [compositionHtml, setCompositionHtml] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [canonicalPath, setCanonicalPath] = useState('');
  const [seoNoIndex, setSeoNoIndex] = useState(false);
  const [active, setActive] = useState(true);
  const [excludeFromCatalog, setExcludeFromCatalog] = useState(false);
  const [variants, setVariants] = useState<AdminVariant[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  /** Ароматы со смайликами — по одному на строку в textarea */
  const [cardAromaLabelsText, setCardAromaLabelsText] = useState('');
  const [badgeLabel, setBadgeLabel] = useState('');

  const [catalogTagIds, setCatalogTagIds] = useState<Set<string>>(() => new Set());
  const [collectionIds, setCollectionIds] = useState<Set<string>>(() => new Set());
  const [productSetIds, setProductSetIds] = useState<Set<string>>(() => new Set());

  const [tagPick, setTagPick] = useState('');
  const [collectionPick, setCollectionPick] = useState('');
  const [setPick, setSetPick] = useState('');
  const [pendingDeleteVariant, setPendingDeleteVariant] = useState<AdminVariant | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState(false);
  const [productBusy, setProductBusy] = useState(false);

  function markDirty() {
    setDirty(true);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setLoadFailed(false);
      try {
        const [cats, tags, cols, sets, p] = await Promise.all([
          adminBackendJson<AdminCategory[]>('catalog/admin/categories'),
          adminBackendJson<AdminCatalogTag[]>('catalog/admin/catalog-tags'),
          adminBackendListAllPages<PickRow>('catalog/admin/collections'),
          adminBackendListAllPages<PickRow>('catalog/admin/product-sets'),
          productId
            ? adminBackendJson<AdminProduct>(`catalog/admin/products/${productId}`)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setCatalogTags(tags);
        setCollections(cols.map((c) => ({ id: c.id, name: c.name })));
        setProductSets(sets.map((s) => ({ id: s.id, name: s.name })));
        if (!isEdit && cats[0]) setCategoryId(cats[0].id);

        if (p) {
          setName(p.name);
          setSlug(p.slug);
          setCategoryId(p.categoryId);
          setShortDescription(p.shortDescription ?? '');
          setPageShortDescriptionHtml(p.pageShortDescriptionHtml ?? '');
          setDescriptionHtml(p.descriptionHtml ?? '');
          setActionEffectHtml(p.actionEffectHtml ?? '');
          setCompositionHtml(p.compositionHtml ?? '');
          setMetaTitle(p.metaTitle ?? '');
          setMetaDescription(p.metaDescription ?? '');
          setOgImageUrl(p.ogImageUrl ?? '');
          setCanonicalPath(p.canonicalPath ?? '');
          setSeoNoIndex(Boolean(p.seoNoIndex));
          setActive(p.active);
          setExcludeFromCatalog(Boolean(p.excludeFromCatalog));
          setVariants(p.variants ?? []);
          setImages(p.images ?? []);
          setCardAromaLabelsText((p.cardAromaLabels ?? []).join('\n'));
          setBadgeLabel(p.badgeLabel ?? '');
          setCatalogTagIds(new Set(p.catalogTagIds ?? []));
          setCollectionIds(new Set(p.collectionIds ?? []));
          setProductSetIds(new Set(p.productSetIds ?? []));
        }
        setDirty(false);
      } catch (e) {
        if (!cancelled) {
          setLoadFailed(Boolean(productId));
          setError(e instanceof AdminBackendRequestError ? e.message : 'Ошибка загрузки');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, isEdit]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const tagsAvailable = useMemo(
    () => catalogTags.filter((t) => !catalogTagIds.has(t.id)),
    [catalogTags, catalogTagIds],
  );
  const collectionsAvailable = useMemo(
    () => collections.filter((c) => !collectionIds.has(c.id)),
    [collections, collectionIds],
  );
  const setsAvailable = useMemo(
    () => productSets.filter((s) => !productSetIds.has(s.id)),
    [productSets, productSetIds],
  );

  function productPayload() {
    return {
      name: name.trim(),
      slug: slug.trim() || undefined,
      categoryId,
      shortDescription: shortDescription.trim() || null,
      pageShortDescriptionHtml: pageShortDescriptionHtml.trim() || null,
      descriptionHtml: descriptionHtml.trim() || null,
      actionEffectHtml: actionEffectHtml.trim() || null,
      compositionHtml: compositionHtml.trim() || null,
      /** Mira leftovers — очищаем при сохранении */
      applicationHtml: null,
      importantNoteHtml: null,
      vspomniNoteHtml: null,
      storageOptionId: null,
      productTypeOptionId: null,
      purposeOptionId: null,
      shelfLifeOptionId: null,
      metaTitle: metaTitle.trim() || null,
      metaDescription: metaDescription.trim() || null,
      ogImageUrl: ogImageUrl.trim() || null,
      canonicalPath: canonicalPath.trim() || null,
      seoNoIndex,
      active,
      excludeFromCatalog,
      cardAromaLabels: cardAromaLabelsText
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean),
      badgeLabel: badgeLabel.trim() || null,
      catalogTagIds: Array.from(catalogTagIds),
      collectionIds: Array.from(collectionIds),
      productSetIds: Array.from(productSetIds),
    };
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!name.trim()) throw new Error('Укажите название');
      if (!categoryId) throw new Error('Выберите категорию');
      if (isEdit && !slug.trim()) {
        throw new Error('Slug нельзя очищать — укажите значение или верните прежний');
      }

      if (!isEdit) {
        const created = await adminBackendJson<AdminProduct>('catalog/admin/products', {
          method: 'POST',
          body: JSON.stringify(productPayload()),
        });
        await revalidateCatalogStorefront({ productSlug: created.slug });
        showToast('Товар создан');
        router.replace(`/admin/catalog/products/${created.id}`);
        router.refresh();
        return;
      }

      const refreshed = await adminBackendJson<AdminProduct>(
        `catalog/admin/products/${productId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(productPayload()),
        },
      );
      setSlug(refreshed.slug);
      setVariants(refreshed.variants ?? []);
      setImages(refreshed.images ?? []);
      setCatalogTagIds(new Set(refreshed.catalogTagIds ?? []));
      setCollectionIds(new Set(refreshed.collectionIds ?? []));
      setProductSetIds(new Set(refreshed.productSetIds ?? []));
      setCardAromaLabelsText((refreshed.cardAromaLabels ?? []).join('\n'));
      setBadgeLabel(refreshed.badgeLabel ?? '');
      setDirty(false);
      await revalidateCatalogStorefront({ productSlug: refreshed.slug });
      showToast('Сохранено');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof AdminBackendRequestError || err instanceof Error
          ? err.message
          : 'Не удалось сохранить',
      );
    } finally {
      setSaving(false);
    }
  }

  async function hideProduct() {
    if (!productId) return;
    setProductBusy(true);
    setError(null);
    try {
      const refreshed = await adminBackendJson<AdminProduct>(
        `catalog/admin/products/${productId}`,
        { method: 'PATCH', body: JSON.stringify({ active: false }) },
      );
      setActive(false);
      setDirty(false);
      await revalidateCatalogStorefront({ productSlug: refreshed.slug || slug || undefined });
      showToast('Товар скрыт из каталога');
      router.refresh();
    } catch (e) {
      setError(e instanceof AdminBackendRequestError ? e.message : 'Не удалось скрыть');
    } finally {
      setProductBusy(false);
    }
  }

  async function deleteProductConfirmed() {
    if (!productId) return;
    setPendingDeleteProduct(false);
    setProductBusy(true);
    setError(null);
    try {
      await adminBackendJson(`catalog/admin/products/${productId}`, { method: 'DELETE' });
      await revalidateCatalogStorefront({ productSlug: slug || undefined });
      showToast('Товар удалён');
      router.replace('/admin/catalog/products');
      router.refresh();
    } catch (e) {
      const msg =
        e instanceof AdminBackendRequestError
          ? e.message
          : 'Не удалось удалить товар';
      setError(msg);
      showToast('Удаление невозможно — можно скрыть товар');
    } finally {
      setProductBusy(false);
    }
  }

  async function removeVariantConfirmed() {
    const v = pendingDeleteVariant;
    if (!v) return;
    setPendingDeleteVariant(null);
    try {
      await adminBackendJson(`catalog/admin/variants/${v.id}`, { method: 'DELETE' });
      setVariants((prev) => prev.filter((x) => x.id !== v.id));
      await revalidateCatalogStorefront({ productSlug: slug || undefined });
      showToast('Вариант удалён');
    } catch (e) {
      setError(e instanceof AdminBackendRequestError ? e.message : 'Не удалось удалить вариант');
    }
  }

  async function duplicateVariant(v: AdminVariant) {
    setDuplicatingId(v.id);
    setError(null);
    try {
      const created = await adminBackendJson<AdminVariant>(
        `catalog/admin/variants/${v.id}/duplicate`,
        { method: 'POST' },
      );
      setVariants((prev) => [...prev, created]);
      await revalidateCatalogStorefront({ productSlug: slug || undefined });
      showToast('Вариант скопирован');
      router.push(`/admin/catalog/products/${productId}/variants/${created.id}`);
    } catch (e) {
      setError(e instanceof AdminBackendRequestError ? e.message : 'Не удалось скопировать');
    } finally {
      setDuplicatingId(null);
    }
  }

  if (loading) {
    return <p className={styles.muted}>Загрузка…</p>;
  }

  if (loadFailed) {
    return (
      <div className={styles.form}>
        <p className={styles.backRow}>
          <AdminCompactBtnLink href="/admin/catalog/products" variant="outline">
            ← К списку
          </AdminCompactBtnLink>
        </p>
        <p className={styles.error} role="alert">
          {error ?? 'Не удалось загрузить товар'}
        </p>
      </div>
    );
  }

  const titleText = name.trim() || (isEdit ? 'Товар' : 'Новый товар');
  const storefrontHref =
    slug.trim() && active && !excludeFromCatalog ? `/product/${slug.trim()}` : null;

  return (
    <form
      onSubmit={(e) => void onSave(e)}
      className={`${styles.form} ${styles.formWide}`}
      style={{ gap: 14 }}
    >
      <div className={pn.stickyToolbar}>
        <div className={pn.stickyToolbarMain}>
          <div className={pn.stickyToolbarNav}>
            <AdminCompactBtnLink href="/admin/catalog/products" variant="outline">
              ← К списку
            </AdminCompactBtnLink>
            {storefrontHref ? (
              <a
                className={pn.storefrontLink}
                href={storefrontHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                На витрине ↗
              </a>
            ) : null}
            {dirty ? <span className={pn.dirtyHintInline}>Несохранённые изменения</span> : null}
          </div>
          <h1 className={pn.stickyToolbarTitle}>{titleText}</h1>
        </div>
        <div className={pn.stickyToolbarActions}>
          {isEdit ? (
            <>
              {active ? (
                <AdminCompactBtn
                  type="button"
                  variant="outline"
                  disabled={productBusy || saving}
                  onClick={() => void hideProduct()}
                >
                  Скрыть
                </AdminCompactBtn>
              ) : null}
              <AdminCompactBtn
                type="button"
                variant="outline"
                className={styles.iconDangerBtn}
                disabled={productBusy || saving}
                onClick={() => setPendingDeleteProduct(true)}
                aria-label="Удалить товар"
                title="Удалить товар"
              >
                <TrashIcon />
              </AdminCompactBtn>
            </>
          ) : null}
          <AdminCompactBtn type="submit" variant="accent" disabled={saving || productBusy}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </AdminCompactBtn>
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {categories.length === 0 ? (
        <p className={styles.error}>
          Нет категорий. Создайте на странице{' '}
          <Link href="/admin/catalog/categories">Категории</Link>.
        </p>
      ) : null}

      <div className={pn.productFormGrid}>
        <div className={pn.productFormMain}>
          <AdminTextField
            label="Название"
            value={name}
            onChange={(e) => {
              markDirty();
              setName(e.target.value);
            }}
            required
          />
          <AdminTextField
            label="Slug"
            value={slug}
            onChange={(e) => {
              markDirty();
              setSlug(e.target.value);
            }}
            placeholder={isEdit ? undefined : 'пусто → авто из названия'}
          />

          {isEdit && productId ? (
            <ProductGalleryEditor
              productId={productId}
              productSlug={slug}
              images={images}
              onChange={setImages}
              onPersisted={() => showToast('Галерея обновлена')}
            />
          ) : (
            <p className={styles.cardNote}>Галерею можно добавить после первого сохранения товара.</p>
          )}

          <AdminAccordion title="Описание" defaultOpen>
            <AdminTextArea
              label="Описание в карточке товара"
              value={shortDescription}
              onChange={(e) => {
                markDirty();
                setShortDescription(e.target.value);
              }}
              rows={3}
            />
            <AdminRichField
              label="Короткое описание на странице товара"
              value={pageShortDescriptionHtml}
              onChange={(v) => {
                markDirty();
                setPageShortDescriptionHtml(v);
              }}
            />
            <AdminRichField
              label="Описание"
              value={descriptionHtml}
              onChange={(v) => {
                markDirty();
                setDescriptionHtml(v);
              }}
            />
          </AdminAccordion>

          <AdminAccordion title="Характеристики и состав" defaultOpen>
            <AdminRichField
              label="Характеристики"
              value={actionEffectHtml}
              onChange={(v) => {
                markDirty();
                setActionEffectHtml(v);
              }}
            />
            <p className={pn.placementHint}>
              Объём, комплектация, сроки — то, что видит покупатель в блоке «Характеристики» на
              PDP.
            </p>
            <AdminRichField
              label="Состав"
              value={compositionHtml}
              onChange={(v) => {
                markDirty();
                setCompositionHtml(v);
              }}
            />
          </AdminAccordion>

          <AdminAccordion title="SEO">
            <p className={pn.placementHint}>
              Пустые поля подставляются из названия, описания и обложки товара.
            </p>
            <AdminTextField
              label="Meta title"
              value={metaTitle}
              onChange={(e) => {
                markDirty();
                setMetaTitle(e.target.value);
              }}
              maxLength={500}
            />
            <AdminTextArea
              label="Meta description"
              value={metaDescription}
              onChange={(e) => {
                markDirty();
                setMetaDescription(e.target.value);
              }}
              rows={3}
              maxLength={500}
            />
            <AdminTextField
              label="OG-картинка"
              value={ogImageUrl}
              onChange={(e) => {
                markDirty();
                setOgImageUrl(e.target.value);
              }}
              placeholder="/uploads/…"
            />
            <AdminTextField
              label="Canonical path"
              value={canonicalPath}
              onChange={(e) => {
                markDirty();
                setCanonicalPath(e.target.value);
              }}
              placeholder={slug.trim() ? `/product/${slug.trim()}` : '/product/slug'}
            />
            <div className={styles.labelCheckboxRow}>
              <AdminCheckbox
                id="product-seo-no-index"
                className={styles.adminCheckboxForm}
                checked={seoNoIndex}
                onChange={(e) => {
                  markDirty();
                  setSeoNoIndex(e.target.checked);
                }}
                aria-label="Не индексировать"
              />
              <label htmlFor="product-seo-no-index">Не индексировать (noindex)</label>
            </div>
          </AdminAccordion>
        </div>

        <aside className={pn.productFormPlacement} aria-label="Расположение в каталоге">
          <p className={pn.placementHeading}>Расположение в каталоге</p>

          <div className={pn.placementBlock}>
            <AdminSelect
              label="Категория"
              value={categoryId}
              onChange={(e) => {
                markDirty();
                setCategoryId(e.target.value);
              }}
              required
            >
              <option value="" disabled>
                Выберите
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryOptionLabel(c)}
                </option>
              ))}
            </AdminSelect>
          </div>

          <div className={pn.placementBlock}>
            <div className={styles.labelCheckboxRow}>
              <AdminCheckbox
                id="product-active"
                className={styles.adminCheckboxForm}
                checked={active}
                onChange={(e) => {
                  markDirty();
                  setActive(e.target.checked);
                }}
                aria-label="Активен"
              />
              <label htmlFor="product-active">Активен</label>
            </div>
            <p className={pn.placementHint}>
              Выключенный товар недоступен ни на витрине, ни как подарок
            </p>
            <div className={styles.labelCheckboxRow}>
              <AdminCheckbox
                id="product-exclude-from-catalog"
                className={styles.adminCheckboxForm}
                checked={excludeFromCatalog}
                onChange={(e) => {
                  markDirty();
                  setExcludeFromCatalog(e.target.checked);
                }}
                aria-label="Скрыть из каталога"
              />
              <label htmlFor="product-exclude-from-catalog">Скрыть из каталога</label>
            </div>
            <p className={pn.placementHint}>
              Не показывать в каталоге / поиске / PDP. Можно аттачить как подарок
              благодарности
            </p>
          </div>

          <div className={pn.placementBlock}>
            <h3 className={`${styles.groupHeading} ${pn.placementGroupHeading}`}>Карточка витрины</h3>
            <p className={pn.placementHint}>
              Ароматы со смайликами под фото и лейбл (NEW) в углу карточки
            </p>
            <AdminTextArea
              label="Ароматы в карточке"
              value={cardAromaLabelsText}
              onChange={(e) => {
                markDirty();
                setCardAromaLabelsText(e.target.value);
              }}
              rows={3}
              placeholder={'сладкий 🤤\nшоколадный 🍫\nсливочный 🍦'}
            />
            <AdminTextField
              label="Лейбл (NEW и т.п.)"
              value={badgeLabel}
              onChange={(e) => {
                markDirty();
                setBadgeLabel(e.target.value);
              }}
              maxLength={32}
              placeholder="NEW"
            />
            <p className={pn.placementHint}>Пустое поле — без бейджа на карточке</p>
          </div>

          <div className={pn.placementBlock}>
            <h3 className={`${styles.groupHeading} ${pn.placementGroupHeading}`}>Ароматы</h3>
            <p className={pn.placementHint}>Теги ароматов в каталоге / фильтре</p>
            <div className={pn.additionalCatsWrap}>
              <AdminSelect
                label="Добавить тег"
                value={tagPick}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  markDirty();
                  setCatalogTagIds((prev) => new Set(prev).add(id));
                  setTagPick('');
                }}
                disabled={tagsAvailable.length === 0}
              >
                <option value="">Выберите</option>
                {tagsAvailable.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </AdminSelect>
              {catalogTagIds.size > 0 ? (
                <AdminPillChipList aria-label="Ароматы">
                  {[...catalogTagIds].map((id) => {
                    const t = catalogTags.find((x) => x.id === id);
                    return (
                      <AdminPillChip
                        key={id}
                        onRemove={() => {
                          markDirty();
                          setCatalogTagIds((prev) => {
                            const next = new Set(prev);
                            next.delete(id);
                            return next;
                          });
                        }}
                        removeAriaLabel={`Убрать «${t?.name ?? id}»`}
                      >
                        {t?.name ?? id}
                      </AdminPillChip>
                    );
                  })}
                </AdminPillChipList>
              ) : (
                <p className={styles.muted} style={{ marginTop: 0 }}>
                  Не выбран
                </p>
              )}
            </div>
          </div>

          <div className={pn.placementBlock}>
            <h3 className={`${styles.groupHeading} ${pn.placementGroupHeading}`}>Наборы</h3>
            <p className={pn.placementHint}>Товар можно включить в один или несколько наборов.</p>
            <div className={pn.additionalCatsWrap}>
              <AdminSelect
                label="Добавить набор"
                value={setPick}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  markDirty();
                  setProductSetIds((prev) => new Set(prev).add(v));
                  setSetPick('');
                }}
                disabled={setsAvailable.length === 0}
              >
                <option value="">Выберите</option>
                {setsAvailable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </AdminSelect>
              {productSetIds.size > 0 ? (
                <AdminPillChipList aria-label="Выбранные наборы">
                  {Array.from(productSetIds).map((id) => {
                    const row = productSets.find((x) => x.id === id);
                    if (!row) return null;
                    return (
                      <AdminPillChip
                        key={id}
                        onRemove={() => {
                          markDirty();
                          setProductSetIds((prev) => {
                            const next = new Set(prev);
                            next.delete(id);
                            return next;
                          });
                        }}
                        removeAriaLabel={`Убрать «${row.name}»`}
                      >
                        {row.name}
                      </AdminPillChip>
                    );
                  })}
                </AdminPillChipList>
              ) : (
                <p className={styles.muted} style={{ marginTop: 0 }}>
                  Не выбран
                </p>
              )}
            </div>
          </div>

          <div className={pn.placementBlock}>
            <h3 className={`${styles.groupHeading} ${pn.placementGroupHeading}`}>Коллекции</h3>
            <div className={pn.additionalCatsWrap}>
              <AdminSelect
                label="Добавить коллекцию"
                value={collectionPick}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  markDirty();
                  setCollectionIds((prev) => new Set(prev).add(v));
                  setCollectionPick('');
                }}
                disabled={collectionsAvailable.length === 0}
              >
                <option value="">Выберите</option>
                {collectionsAvailable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </AdminSelect>
              {collectionIds.size > 0 ? (
                <AdminPillChipList aria-label="Выбранные коллекции">
                  {Array.from(collectionIds).map((id) => {
                    const row = collections.find((x) => x.id === id);
                    if (!row) return null;
                    return (
                      <AdminPillChip
                        key={id}
                        onRemove={() => {
                          markDirty();
                          setCollectionIds((prev) => {
                            const next = new Set(prev);
                            next.delete(id);
                            return next;
                          });
                        }}
                        removeAriaLabel={`Убрать «${row.name}»`}
                      >
                        {row.name}
                      </AdminPillChip>
                    );
                  })}
                </AdminPillChipList>
              ) : (
                <p className={styles.muted} style={{ marginTop: 0 }}>
                  Не выбрана
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {isEdit && productId ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.groupHeading}>Варианты</h2>
            <AdminCompactBtnLink
              href={`/admin/catalog/products/${productId}/variants/new`}
              variant="accent"
            >
              Создать вариант
            </AdminCompactBtnLink>
          </div>
          {variants.length === 0 ? (
            <p className={styles.muted}>Вариантов пока нет</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Объём, мл</th>
                    <th>Цена, ₽</th>
                    <th>Остаток</th>
                    <th>SKU</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <Link href={`/admin/catalog/products/${productId}/variants/${v.id}`}>
                          {v.name}
                        </Link>
                      </td>
                      <td>{v.volumeMl ?? '—'}</td>
                      <td>{v.price}</td>
                      <td>{v.stock}</td>
                      <td className={styles.mutedInline}>{v.sku}</td>
                      <td>{v.active ? 'Активен' : 'Скрыт'}</td>
                      <td className={styles.tableCellActions}>
                        <AdminCompactBtn
                          type="button"
                          variant="outline"
                          className={styles.iconBtn}
                          disabled={duplicatingId === v.id}
                          onClick={() => void duplicateVariant(v)}
                          aria-label={`Копировать вариант «${v.name}»`}
                          title="Копия"
                        >
                          {duplicatingId === v.id ? '…' : <CopyIcon />}
                        </AdminCompactBtn>
                        <AdminCompactBtn
                          type="button"
                          variant="outline"
                          className={styles.iconDangerBtn}
                          onClick={() => setPendingDeleteVariant(v)}
                          aria-label={`Удалить вариант «${v.name}»`}
                          title="Удалить"
                        >
                          <TrashIcon />
                        </AdminCompactBtn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <AdminConfirmDialog
        open={pendingDeleteVariant != null}
        title="Удалить вариант?"
        message={
          pendingDeleteVariant
            ? `Вариант «${pendingDeleteVariant.name}» будет удалён безвозвратно.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        onConfirm={() => void removeVariantConfirmed()}
        onCancel={() => setPendingDeleteVariant(null)}
      />
      <AdminConfirmDialog
        open={pendingDeleteProduct}
        title="Удалить товар?"
        message={`Товар «${name || 'без названия'}» и все его варианты будут удалены. Если товар есть в заказах — удаление будет отклонено, скройте его.`}
        confirmLabel="Удалить"
        danger
        onConfirm={() => void deleteProductConfirmed()}
        onCancel={() => setPendingDeleteProduct(false)}
      />
    </form>
  );
}
