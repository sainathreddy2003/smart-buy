import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { FEATURE_OPTIONS } from "../../lib/intakeOptions";
import { cn } from "../../lib/utils";

export function StepFeatures({ category, selected, onToggle, notes, onNotesChange }) {
  const options = FEATURE_OPTIONS[category] || FEATURE_OPTIONS.smartphone;

  return (
    <div>
      <h2 className="font-serif text-2xl font-normal text-[var(--color-text)] sm:text-3xl">
        Any essential features?
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Select all non-negotiable attributes — or proceed directly and let our neural filter prioritize.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {options.map((feature, i) => {
          const isSelected = selected.includes(feature);
          return (
            <motion.button
              key={feature}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onToggle(feature)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-xs font-medium transition-all duration-200",
                isSelected
                  ? "border-[var(--color-amber)] bg-[var(--color-amber)]/10 text-[var(--color-text)] shadow-[0_0_16px_rgba(33,12,2,0.15)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)]/40 text-[var(--color-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 flex-none items-center justify-center rounded border transition-colors",
                  isSelected
                    ? "border-[var(--color-amber)] bg-[var(--color-amber)] text-[var(--color-bg)]"
                    : "border-[var(--color-border-strong)] bg-transparent"
                )}
              >
                {isSelected && <Check size={11} strokeWidth={3} />}
              </span>
              <span className="font-medium">{feature}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-8">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
          Specific Preferences or Constraints (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g., Must have at least 16GB unified memory, matte display preferred, and good thermal performance."
          className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 px-4 py-3 text-xs text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-amber)] focus:ring-1 focus:ring-[var(--color-amber)]/40 placeholder:text-[var(--color-text-faint)]"
        />
      </div>
    </div>
  );
}
