import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_COMPARE = 4;

export const useCompareStore = create(
  persist(
    (set, get) => ({
      ids: [],

      isSelected: (productId) => get().ids.includes(productId),

      toggle: (productId) =>
        set((state) => {
          if (state.ids.includes(productId)) {
            return { ids: state.ids.filter((id) => id !== productId) };
          }
          if (state.ids.length >= MAX_COMPARE) return state;
          return { ids: [...state.ids, productId] };
        }),

      clear: () => set({ ids: [] }),
    }),
    { name: "smartbuy-compare" }
  )
);
