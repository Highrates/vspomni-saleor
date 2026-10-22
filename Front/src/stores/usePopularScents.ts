import { create } from 'zustand'
import { ProductCardItem } from '@/types/product'
import { getPopularProducts } from '@/graphql/queries/product.service'

interface PopularScentsState {
  greed: ProductCardItem[]
  setGrid: (items: ProductCardItem[]) => void
  fetchGrid: () => void
}

export const usePopularScentsStore = create<PopularScentsState>()((set) => ({
  greed: [],
  setGrid: (items) => {
    set({ greed: items })
  },
  fetchGrid: async () => {
    const result = await getPopularProducts()
    set({ greed: result })
  },
}))
