/** Пирамида нот на PDP (Nest ProductAromaNote + AromaNoteDefinition). */

export type ProductNoteKind = 'BASIC' | 'MIDDLE' | 'HEAD'

export type ProductNote = {
  id: string
  kind: ProductNoteKind
  name: string
  imageUrl: string | null
  sortOrder: number
}

export type ProductNoteLayerKey = 'basic' | 'middle' | 'head'

export type ProductNoteLayer = {
  key: ProductNoteLayerKey
  kind: ProductNoteKind
  label: string
  notes: ProductNote[]
}

export const NOTE_LAYER_META: Record<
  ProductNoteLayerKey,
  { kind: ProductNoteKind; label: string }
> = {
  basic: { kind: 'BASIC', label: 'Базовые ноты' },
  middle: { kind: 'MIDDLE', label: 'Средние ноты' },
  head: { kind: 'HEAD', label: 'Верхние аккорды' },
}

/** Порядок слоёв на PDP: базовые + средние в ряд, верхние ниже. */
export const NOTE_LAYER_ORDER: ProductNoteLayerKey[] = ['basic', 'middle', 'head']

export function parseNoteKind(raw: string | undefined | null): ProductNoteKind | null {
  const k = String(raw || '')
    .trim()
    .toUpperCase()
  if (k === 'BASIC' || k === 'MIDDLE' || k === 'HEAD') return k
  return null
}

export function buildProductNotes(
  raw:
    | Array<{
        id: string
        kind: string
        name: string
        imageUrl: string | null
        sortOrder: number
      }>
    | null
    | undefined,
  resolveImageUrl: (url: string | null | undefined) => string | null,
): ProductNote[] {
  const out: ProductNote[] = []
  for (const n of raw ?? []) {
    const kind = parseNoteKind(n.kind)
    const name = String(n.name || '').trim()
    if (!kind || !name) continue
    out.push({
      id: n.id,
      kind,
      name,
      imageUrl: resolveImageUrl(n.imageUrl),
      sortOrder: Number.isFinite(n.sortOrder) ? n.sortOrder : 0,
    })
  }
  return out.sort((a, b) => {
    if (a.kind !== b.kind) {
      const order = { BASIC: 0, MIDDLE: 1, HEAD: 2 } as const
      return order[a.kind] - order[b.kind]
    }
    return a.sortOrder - b.sortOrder
  })
}

export function groupNotesIntoLayers(notes: ProductNote[]): ProductNoteLayer[] {
  return NOTE_LAYER_ORDER.map((key) => {
    const meta = NOTE_LAYER_META[key]
    return {
      key,
      kind: meta.kind,
      label: meta.label,
      notes: notes.filter((n) => n.kind === meta.kind),
    }
  }).filter((layer) => layer.notes.length > 0)
}

/** Для SEO / JSON-LD: только непустые слои. */
export function noteLayersForSeo(
  notes: ProductNote[],
): { label: string; names: string[] }[] {
  return groupNotesIntoLayers(notes).map((layer) => ({
    label: layer.label,
    names: layer.notes.map((n) => n.name),
  }))
}
