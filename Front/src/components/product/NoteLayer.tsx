'use client'

import type { ProductNoteLayer } from '@/lib/product/aromaNotes'
import NoteChip from './NoteChip'

export default function NoteLayer({
  layer,
  className = '',
}: {
  layer: ProductNoteLayer
  className?: string
}) {
  if (!layer.notes.length) return null

  return (
    <div className={`flex flex-col gap-1.5 sm:gap-2 ${className}`.trim()}>
      <h5 className="font-semibold text-base sm:text-lg text-black select-none">
        {layer.label}
      </h5>
      <div className="flex flex-row flex-wrap gap-3 sm:gap-4">
        {layer.notes.map((note) => (
          <NoteChip key={note.id} note={note} />
        ))}
      </div>
    </div>
  )
}
