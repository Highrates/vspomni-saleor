'use client'

import UnpackingCard from './UnpackingCard'
import StarStyleSwiper from './StarStyleSwiper'
import type { UnpackingReelItem } from '@/types/unpacking'

type Props = {
  items: UnpackingReelItem[]
}

export default function UnpackingSwiper({ items }: Props) {
  return (
    <StarStyleSwiper
      slides={items.map((item) => ({
        key: item.id,
        node: <UnpackingCard item={item} />,
      }))}
    />
  )
}
