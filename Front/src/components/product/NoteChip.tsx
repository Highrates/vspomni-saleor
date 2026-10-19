'use client'

import Image from 'next/image'
import type { ProductNote } from '@/lib/product/aromaNotes'

function isNextImageSafe(url: string): boolean {
  if (url.startsWith('/')) return true
  try {
    const u = new URL(url)
    return (
      u.hostname === 'vspomni.store' ||
      u.hostname === 'www.vspomni.store' ||
      u.hostname === 'localhost' ||
      u.hostname === '127.0.0.1'
    )
  } catch {
    return false
  }
}

export default function NoteChip({ note }: { note: ProductNote }) {
  const src = note.imageUrl?.trim() || ''
  const useNext = Boolean(src && isNextImageSafe(src))

  return (
    <div className="flex flex-col items-center gap-2 w-[84px] shrink-0">
      <div className="w-[84px] h-[84px] rounded-[12px] overflow-hidden bg-gray-100 flex-shrink-0 relative">
        {src ? (
          useNext ? (
            <Image
              src={src}
              alt={note.name}
              width={84}
              height={84}
              sizes="84px"
              className="w-full h-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={note.name}
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 px-1 text-center">
            {note.name}
          </span>
        )}
      </div>
      <p className="text-xs font-normal text-center text-black w-full">{note.name}</p>
    </div>
  )
}
