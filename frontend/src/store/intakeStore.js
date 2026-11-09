import { create } from "zustand";

const initialPreferences = {
  category: null,
  budgetMin: undefined,
  budgetMax: undefined,
  useCase: null,
  mustHaveFeatures: [],
  notes: "",
};

export const useIntakeStore = create((set) => ({
  step: 0,
  preferences: { ...initialPreferences },

  setField: (field, value) =>
    set((state) => ({ preferences: { ...state.preferences, [field]: value } })),
  toggleFeature: (feature) =>
    set((state) => {
      const has = state.preferences.mustHaveFeatures.includes(feature);
      return {
        preferences: {
          ...state.preferences,
          mustHaveFeatures: has
            ? state.preferences.mustHaveFeatures.filter((f) => f !== feature)
            : [...state.preferences.mustHaveFeatures, feature],
        },
      };
    }),
  nextStep: () => set((state) => ({ step: state.step + 1 })),
  prevStep: () => set((state) => ({ step: Math.max(0, state.step - 1) })),
  goToStep: (step) => set({ step }),
  reset: () => set({ step: 0, preferences: { ...initialPreferences } }),
}));
