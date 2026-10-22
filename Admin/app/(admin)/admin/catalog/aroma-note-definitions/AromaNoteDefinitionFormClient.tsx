'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toRelativeMediaPath } from '@vspomni/media-path';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminTextField } from '@/components/AdminTextField/AdminTextField';
import {
  AdminBackendRequestError,
  adminBackendFetch,
  adminBackendJson,
  readAdminApiError,
} from '@/lib/adminBackendFetch';
import type { AdminAromaNoteDefinition } from '@/lib/adminCatalogTypes';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import pn from '@/app/(admin)/admin/catalog/products/productNew.module.css';

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await adminBackendFetch('catalog/admin/upload-rich-media?type=image', {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    throw new AdminBackendRequestError(await readAdminApiError(res), res.status);
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error('Сервер не вернул URL изображения');
  return toRelativeMediaPath(data.url) || data.url.trim();
}

export function AromaNoteDefinitionFormClient({
  definitionId,
}: {
  definitionId?: string;
}) {
  const isEdit = Boolean(definitionId);
  const router = useRouter();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!definitionId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await adminBackendJson<AdminAromaNoteDefinition>(
          `catalog/admin/aroma-note-definitions/${definitionId}`,
        );
        if (cancelled) return;
        setName(row.name);
        setImageUrl(row.imageUrl ?? '');
        setProductCount(row.productCount ?? 0);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [definitionId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Укажите название');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        imageUrl: imageUrl.trim() || null,
      };
      if (isEdit && definitionId) {
        await adminBackendJson(`catalog/admin/aroma-note-definitions/${definitionId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        showToast('Сохранено');
      } else {
        const created = await adminBackendJson<AdminAromaNoteDefinition>(
          'catalog/admin/aroma-note-definitions',
          { method: 'POST', body: JSON.stringify(body) },
        );
        showToast('Нота создана');
        router.push(`/admin/catalog/aroma-note-definitions/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  const preview = toRelativeMediaPath(imageUrl) || imageUrl;

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>
          {isEdit ? 'Нота пирамиды' : 'Новая нота пирамиды'}
        </h1>
        <AdminCompactBtnLink
          href="/admin/catalog/aroma-note-definitions"
          variant="outline"
        >
          К списку
        </AdminCompactBtnLink>
      </div>

      {loading ? <p className={styles.cardNote}>Загрузка…</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {!loading ? (
        <form className={styles.card} onSubmit={(e) => void onSave(e)}>
          {isEdit ? (
            <p className={styles.cardNote}>Используется в товарах: {productCount}</p>
          ) : null}
          <AdminTextField
            label="Название"
            value={name}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваниль"
          />
          <div className={pn.noteThumbCol} style={{ marginTop: 12 }}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={pn.noteThumb} src={preview} alt="" />
            ) : (
              <div className={pn.noteThumbEmpty}>нет фото</div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={styles.srOnly}
              disabled={saving || uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void (async () => {
                  setUploading(true);
                  try {
                    setImageUrl(await uploadImage(f));
                  } catch (err) {
                    showToast(
                      err instanceof Error ? err.message : 'Не удалось загрузить',
                    );
                  } finally {
                    setUploading(false);
                    if (fileRef.current) fileRef.current.value = '';
                  }
                })();
              }}
            />
            <div className={pn.noteThumbActions}>
              <AdminCompactBtn
                type="button"
                disabled={saving || uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? '…' : preview ? 'Заменить фото' : 'Загрузить фото'}
              </AdminCompactBtn>
              {preview ? (
                <AdminCompactBtn
                  type="button"
                  disabled={saving || uploading}
                  onClick={() => setImageUrl('')}
                >
                  Убрать
                </AdminCompactBtn>
              ) : null}
            </div>
          </div>
          <div className={styles.toolbar} style={{ marginTop: 16 }}>
            <AdminCompactBtn type="submit" variant="accent" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </AdminCompactBtn>
          </div>
        </form>
      ) : null}
    </>
  );
}
