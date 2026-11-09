import { motion } from "framer-motion";
import { CATEGORY_OPTIONS } from "../../lib/intakeOptions";
import { cn } from "../../lib/utils";

export function StepCategory({ value, onSelect }) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-normal text-[var(--color-text)] sm:text-3xl">
        What are you shopping for?
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Choose a hardware product category to initialize your intelligent search.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CATEGORY_OPTIONS.map((opt, i) => {
          const isSelected = value === opt.value;
          return (
            <motion.button
              key={opt.value}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              onClick={() => onSelect(opt.value)}
              className={cn(
                "flex items-start gap-4 rounded-xl border p-5 text-left transition-all duration-200",
                isSelected
                  ? "border-[var(--color-amber)] bg-[var(--color-amber)]/10 shadow-[0_0_24px_rgba(33,12,2,0.2)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)]/40 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 flex-none items-center justify-center rounded-lg border transition-colors",
                  isSelected
                    ? "border-[var(--color-amber)] bg-[var(--color-amber)] text-[var(--color-bg)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-champagne)]"
                )}
              >
                <opt.icon size={20} strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-sm text-[var(--color-text)]">
                  {opt.label}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--color-text-muted)]">
                  {opt.blurb}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
