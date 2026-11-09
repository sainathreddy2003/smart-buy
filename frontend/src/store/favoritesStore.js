import { create } from "zustand";
import { api, getErrorMessage } from "../lib/api";

export const useFavoritesStore = create((set, get) => ({
  ids: new Set(),
  items: [],
  loading: false,
  error: null,

  isFavorite: (productId) => get().ids.has(productId),

  fetchFavorites: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get("/users/favorites");
      set({
        items: data.favorites,
        ids: new Set(data.favorites.map((p) => p._id)),
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: getErrorMessage(err) });
    }
  },

  toggleFavorite: async (product) => {
    const isFav = get().ids.has(product._id);
    const nextIds = new Set(get().ids);
    isFav ? nextIds.delete(product._id) : nextIds.add(product._id);
    set({
      ids: nextIds,
      items: isFav ? get().items.filter((p) => p._id !== product._id) : [...get().items, product],
    });

    try {
      if (isFav) {
        await api.delete(`/users/favorites/${product._id}`);
      } else {
        await api.post(`/users/favorites/${product._id}`);
      }
    } catch (err) {
      // revert on failure
      set({ ids: get().ids, error: getErrorMessage(err) });
      get().fetchFavorites();
    }
  },

  clear: () => set({ ids: new Set(), items: [] }),
}));
