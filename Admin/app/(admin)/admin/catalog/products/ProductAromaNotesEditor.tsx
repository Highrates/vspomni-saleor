'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toRelativeMediaPath } from '@vspomni/media-path';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminTextField } from '@/components/AdminTextField/AdminTextField';
import {
  AdminBackendRequestError,
  adminBackendFetch,
  adminBackendJson,
  readAdminApiError,
} from '@/lib/adminBackendFetch';
import type {
  AdminAromaNoteDefinition,
  AdminAromaNoteKind,
} from '@/lib/adminCatalogTypes';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import pn from './productNew.module.css';

export type AromaNoteDraft = {
  key: string;
  /** Persisted ProductAromaNote.id; empty for new rows */
  id?: string;
  kind: AdminAromaNoteKind;
  definitionId: string;
  name: string;
  /** Override URL; empty → use definition default */
  imageUrl: string;
  definitionImageUrl: string;
};

const KIND_BLOCKS: { kind: AdminAromaNoteKind; title: string; hint: string }[] = [
  {
    kind: 'HEAD',
    title: 'Верхние аккорды',
    hint: 'Первое впечатление — то, что слышно сразу после нанесения',
  },
  {
    kind: 'MIDDLE',
    title: 'Средние ноты',
    hint: 'Сердце аромата — раскрывается через несколько минут',
  },
  {
    kind: 'BASIC',
    title: 'Базовые ноты',
    hint: 'Шлейф — остаётся дольше всего',
  },
];

function newKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function findExactDefinition(
  definitions: AdminAromaNoteDefinition[],
  name: string,
): AdminAromaNoteDefinition | null {
  const q = name.trim().toLocaleLowerCase('ru');
  if (!q) return null;
  return (
    definitions.find((d) => d.name.trim().toLocaleLowerCase('ru') === q) ?? null
  );
}

function bindFromDefinition(
  def: AdminAromaNoteDefinition,
  keepOverride = false,
  currentOverride = '',
): Pick<
  AromaNoteDraft,
  'definitionId' | 'name' | 'definitionImageUrl' | 'imageUrl'
> {
  return {
    definitionId: def.id,
    name: def.name,
    definitionImageUrl: def.imageUrl ?? '',
    imageUrl: keepOverride ? currentOverride : '',
  };
}

async function uploadNoteImage(file: File): Promise<string> {
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

function NoteThumb({
  url,
  hasOverride,
  disabled,
  onUploaded,
  onClear,
}: {
  url: string;
  hasOverride: boolean;
  disabled: boolean;
  onUploaded: (url: string) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const preview = toRelativeMediaPath(url) || url;

  return (
    <div className={pn.noteThumbCol}>
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
        disabled={disabled || busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void (async () => {
            setBusy(true);
            try {
              onUploaded(await uploadNoteImage(f));
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : 'Не удалось загрузить фото',
              );
            } finally {
              setBusy(false);
              if (fileRef.current) fileRef.current.value = '';
            }
          })();
        }}
      />
      <div className={pn.noteThumbActions}>
        <AdminCompactBtn
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? '…' : hasOverride || preview ? 'Заменить' : 'Фото'}
        </AdminCompactBtn>
        {hasOverride ? (
          <AdminCompactBtn type="button" disabled={disabled || busy} onClick={onClear}>
            Убрать
          </AdminCompactBtn>
        ) : null}
      </div>
    </div>
  );
}

function NoteDefinitionPicker({
  definitions,
  valueName,
  definitionId,
  disabled,
  onPick,
  onNameChange,
  onCommitName,
}: {
  definitions: AdminAromaNoteDefinition[];
  valueName: string;
  definitionId: string;
  disabled: boolean;
  onPick: (def: AdminAromaNoteDefinition) => void;
  onNameChange: (name: string) => void;
  onCommitName: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useMemo(
    () => `note-combobox-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  const q = valueName.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return definitions.slice(0, 40);
    return definitions
      .filter((d) => d.name.toLowerCase().includes(q))
      .slice(0, 40);
  }, [definitions, q]);

  useEffect(() => {
    setActiveIdx(0);
  }, [q, open]);

  return (
    <div
      className={pn.noteFields}
      ref={rootRef}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={listboxId}
    >
      <AdminTextField
        label="Нота (справочник)"
        value={valueName}
        disabled={disabled}
        autoComplete="off"
        role="searchbox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={
          open && filtered[activeIdx]
            ? `${listboxId}-opt-${filtered[activeIdx]!.id}`
            : undefined
        }
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            if (rootRef.current?.contains(document.activeElement)) return;
            onCommitName();
            setOpen(false);
          }, 150);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setOpen(true);
            e.preventDefault();
            return;
          }
          if (!open || filtered.length === 0) {
            if (e.key === 'Escape') setOpen(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            const pick = filtered[activeIdx];
            if (pick) {
              e.preventDefault();
              onPick(pick);
              setOpen(false);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        onChange={(e) => {
          onNameChange(e.target.value);
          setOpen(true);
        }}
        placeholder="начните вводить — ваниль, бергамот…"
      />
      {open && filtered.length > 0 ? (
        <ul className={pn.noteSuggestList} role="listbox" id={listboxId}>
          {filtered.map((d, idx) => (
            <li key={d.id} role="presentation">
              <button
                type="button"
                id={`${listboxId}-opt-${d.id}`}
                role="option"
                aria-selected={d.id === definitionId || idx === activeIdx}
                className={
                  idx === activeIdx || d.id === definitionId
                    ? pn.noteSuggestActive
                    : pn.noteSuggestItem
                }
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  onPick(d);
                  setOpen(false);
                }}
              >
                {d.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export type AromaNotesChangeMeta = { silent?: boolean };

export function ProductAromaNotesEditor({
  notes,
  disabled,
  onChange,
  /** Инкремент после save товара — refetch справочника */
  definitionsReloadToken = 0,
}: {
  notes: AromaNoteDraft[];
  disabled?: boolean;
  onChange: (next: AromaNoteDraft[], meta?: AromaNotesChangeMeta) => void;
  definitionsReloadToken?: number;
}) {
  const [definitions, setDefinitions] = useState<AdminAromaNoteDefinition[]>([]);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const { showToast } = useToast();
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const loadDefinitions = useCallback(async () => {
    const rows = await adminBackendJson<AdminAromaNoteDefinition[]>(
      'catalog/admin/aroma-note-definitions',
    );
    setDefinitions(rows);
    return rows;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await loadDefinitions();
        if (cancelled) return;
        // Подтянуть фото для строк, набранных вручную до прихода списка / после refetch
        const current = notesRef.current;
        let changed = false;
        const next = current.map((n) => {
          if (n.definitionId) {
            const def = rows.find((d) => d.id === n.definitionId);
            if (def && (n.definitionImageUrl || '') !== (def.imageUrl ?? '')) {
              changed = true;
              return {
                ...n,
                name: def.name,
                definitionImageUrl: def.imageUrl ?? '',
              };
            }
            return n;
          }
          const exact = findExactDefinition(rows, n.name);
          if (!exact) return n;
          changed = true;
          return {
            ...n,
            ...bindFromDefinition(exact, true, n.imageUrl),
          };
        });
        if (changed) onChangeRef.current(next, { silent: true });
      } catch {
        /* autocomplete empty until next reload */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [definitionsReloadToken, loadDefinitions]);

  function updateNote(key: string, patch: Partial<AromaNoteDraft>) {
    onChange(notes.map((n) => (n.key === key ? { ...n, ...patch } : n)));
  }

  function applyName(key: string, name: string, defs = definitions) {
    const exact = findExactDefinition(defs, name);
    const row = notes.find((n) => n.key === key);
    if (exact) {
      updateNote(key, bindFromDefinition(exact, false, row?.imageUrl ?? ''));
      return;
    }
    updateNote(key, {
      name,
      definitionId: '',
      definitionImageUrl: '',
    });
  }

  function commitName(key: string) {
    const row = notes.find((n) => n.key === key);
    if (!row) return;
    applyName(key, row.name);
  }

  function removeNote(key: string) {
    onChange(notes.filter((n) => n.key !== key));
  }

  function addNote(kind: AdminAromaNoteKind) {
    onChange([
      ...notes,
      {
        key: newKey(),
        kind,
        definitionId: '',
        name: '',
        imageUrl: '',
        definitionImageUrl: '',
      },
    ]);
  }

  function moveNote(key: string, dir: -1 | 1) {
    const idx = notes.findIndex((n) => n.key === key);
    if (idx < 0) return;
    const kind = notes[idx]!.kind;
    const same = notes
      .map((n, i) => ({ n, i }))
      .filter((x) => x.n.kind === kind);
    const pos = same.findIndex((x) => x.i === idx);
    const swapWith = same[pos + dir];
    if (!swapWith) return;
    const next = notes.slice();
    const a = next[idx]!;
    const b = next[swapWith.i]!;
    next[idx] = b;
    next[swapWith.i] = a;
    onChange(next);
  }

  async function createDefinitionInline(key: string) {
    const row = notes.find((n) => n.key === key);
    const name = row?.name.trim() ?? '';
    if (!row || !name) {
      showToast('Сначала укажите название ноты');
      return;
    }
    if (row.definitionId) return;

    const exact = findExactDefinition(definitions, name);
    if (exact) {
      updateNote(key, bindFromDefinition(exact, true, row.imageUrl));
      return;
    }

    setCreatingKey(key);
    try {
      const created = await adminBackendJson<AdminAromaNoteDefinition>(
        'catalog/admin/aroma-note-definitions',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            imageUrl: row.imageUrl.trim() || null,
          }),
        },
      );
      setDefinitions((prev) =>
        [...prev.filter((d) => d.id !== created.id), created].sort((a, b) =>
          a.name.localeCompare(b.name, 'ru'),
        ),
      );
      updateNote(key, {
        ...bindFromDefinition(created, false),
        // фото ушло в справочник
        imageUrl: '',
      });
      showToast(`«${created.name}» добавлена в справочник`);
    } catch (err) {
      // Уже есть (409) или гонка — refetch и bind
      try {
        const rows = await loadDefinitions();
        const existing = findExactDefinition(rows, name);
        if (existing) {
          updateNote(key, bindFromDefinition(existing, true, row.imageUrl));
          showToast(`«${existing.name}» уже в справочнике — привязана`);
          return;
        }
      } catch {
        /* fall through */
      }
      showToast(
        err instanceof Error ? err.message : 'Не удалось создать ноту в справочнике',
      );
    } finally {
      setCreatingKey(null);
    }
  }

  return (
    <div className={pn.notesEditor}>
      <p className={pn.placementHint}>
        Пирамида на PDP (базовые / средние / верхние). Выберите из справочника
        или введите имя — при точном совпадении подтянется фото.{' '}
        <Link
          href="/admin/catalog/aroma-note-definitions"
          className={pn.notesDictLink}
        >
          Управление справочником
        </Link>
      </p>
      {KIND_BLOCKS.map((block) => {
        const rows = notes.filter((n) => n.kind === block.kind);
        return (
          <div key={block.kind} className={pn.noteKindBlock}>
            <div className={pn.noteKindHeader}>
              <div>
                <h3 className={pn.noteKindTitle}>{block.title}</h3>
                <p className={pn.placementHint}>{block.hint}</p>
              </div>
              <AdminCompactBtn
                type="button"
                disabled={disabled}
                onClick={() => addNote(block.kind)}
              >
                + Нота
              </AdminCompactBtn>
            </div>
            {rows.length === 0 ? (
              <p className={styles.cardNote}>Пока пусто — добавьте ноты слоя.</p>
            ) : (
              <ul className={pn.noteList}>
                {rows.map((row, i) => {
                  const displayImage =
                    row.imageUrl || row.definitionImageUrl || '';
                  const canCreateInline =
                    !row.definitionId && Boolean(row.name.trim());
                  return (
                    <li key={row.key} className={pn.noteRow}>
                      <NoteThumb
                        url={displayImage}
                        hasOverride={Boolean(row.imageUrl)}
                        disabled={Boolean(disabled) || creatingKey === row.key}
                        onUploaded={(url) => updateNote(row.key, { imageUrl: url })}
                        onClear={() => updateNote(row.key, { imageUrl: '' })}
                      />
                      <div className={pn.noteFields}>
                        <NoteDefinitionPicker
                          definitions={definitions}
                          valueName={row.name}
                          definitionId={row.definitionId}
                          disabled={Boolean(disabled) || creatingKey === row.key}
                          onPick={(def) =>
                            updateNote(row.key, bindFromDefinition(def))
                          }
                          onNameChange={(name) => applyName(row.key, name)}
                          onCommitName={() => commitName(row.key)}
                        />
                        <p className={styles.cardNote}>
                          {row.definitionId
                            ? row.imageUrl
                              ? 'Своё фото (override)'
                              : row.definitionImageUrl
                                ? 'Фото из справочника'
                                : 'В справочнике, без фото'
                            : row.name.trim()
                              ? 'Новая нота — создастся при сохранении товара'
                              : 'Без фото'}
                        </p>
                        <div className={pn.noteRowActions}>
                          {canCreateInline ? (
                            <AdminCompactBtn
                              type="button"
                              disabled={Boolean(disabled) || creatingKey === row.key}
                              onClick={() => void createDefinitionInline(row.key)}
                            >
                              {creatingKey === row.key
                                ? '…'
                                : row.imageUrl
                                  ? 'Создать в справочнике с фото'
                                  : 'Создать в справочнике'}
                            </AdminCompactBtn>
                          ) : null}
                          <AdminCompactBtn
                            type="button"
                            disabled={disabled || i === 0}
                            onClick={() => moveNote(row.key, -1)}
                          >
                            ↑
                          </AdminCompactBtn>
                          <AdminCompactBtn
                            type="button"
                            disabled={disabled || i === rows.length - 1}
                            onClick={() => moveNote(row.key, 1)}
                          >
                            ↓
                          </AdminCompactBtn>
                          <AdminCompactBtn
                            type="button"
                            disabled={disabled}
                            onClick={() => removeNote(row.key)}
                          >
                            Удалить
                          </AdminCompactBtn>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function aromaNotesToPayload(notes: AromaNoteDraft[]) {
  return notes
    .map((n) => {
      const name = n.name.trim();
      if (!name && !n.definitionId) return null;
      return {
        ...(n.id ? { id: n.id } : {}),
        kind: n.kind,
        ...(n.definitionId
          ? { definitionId: n.definitionId }
          : { name }),
        imageUrl: n.imageUrl.trim() || null,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n != null);
}

export function aromaNotesFromApi(
  list:
    | {
        id: string;
        kind: AdminAromaNoteKind;
        definitionId?: string;
        name: string;
        imageUrl: string | null;
        overrideImageUrl?: string | null;
        definitionImageUrl?: string | null;
      }[]
    | undefined,
): AromaNoteDraft[] {
  return (list ?? []).map((n) => ({
    key: n.id,
    id: n.id,
    kind: n.kind,
    definitionId: n.definitionId ?? '',
    name: n.name,
    imageUrl: n.overrideImageUrl ?? '',
    definitionImageUrl:
      n.definitionImageUrl ??
      (n.overrideImageUrl ? '' : (n.imageUrl ?? '')),
  }));
}
