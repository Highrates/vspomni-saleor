'use client'

import type { ProductNote } from '@/lib/product/aromaNotes'
import { groupNotesIntoLayers } from '@/lib/product/aromaNotes'
import NoteLayer from './NoteLayer'

/**
 * Пирамида нот на PDP.
 * Пустые слои не рендерятся; весь блок скрыт, если нот нет.
 * Layout: базовые + средние в ряд, верхние — на всю ширину ниже.
 */
export default function ProductNotesPyramid({ notes }: { notes: ProductNote[] }) {
  const layers = groupNotesIntoLayers(notes)
  if (!layers.length) return null

  const basic = layers.find((l) => l.key === 'basic')
  const middle = layers.find((l) => l.key === 'middle')
  const head = layers.find((l) => l.key === 'head')
  const topRow = [basic, middle].filter(Boolean)

  return (
    <div className="flex flex-col gap-4">
      {topRow.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-4">
          {topRow.map((layer) => (
            <NoteLayer key={layer!.key} layer={layer!} className="flex-1" />
          ))}
        </div>
      ) : null}
      {head ? <NoteLayer layer={head} /> : null}
    </div>
  )
}
