import { create } from 'zustand'
import { AllAromasItem } from '@/graphql/queries/allAromas.service'
import { getAllAromas } from '@/graphql/queries/allAromas.service'

interface AllAromasState {
  items: AllAromasItem[]
  setItems: (items: AllAromasItem[]) => void
  fetchItems: () => void
}

/** Каталог ароматов — без localStorage: persist гонялся с fetch и оставлял устаревший список. */
export const useAllAromasStore = create<AllAromasState>()((set) => ({
  items: [],
  setItems: (items) => {
    set({ items })
  },
  fetchItems: async () => {
    try {
      const result = await getAllAromas()
      set({ items: result })
    } catch {
      /* оставляем текущий список */
    }
  },
}))
