import { motion } from "framer-motion";
import { USE_CASE_OPTIONS } from "../../lib/intakeOptions";
import { cn } from "../../lib/utils";

const LABELS = {
  everyday: "Everyday & Casual Use",
  photography: "Pro Photography & Cinema",
  gaming: "Competitive Gaming",
  productivity: "High-Volume Productivity",
  budget: "Maximum Value-for-Money",
  students: "Academics & Campus",
  "creative work": "Content Creation & 3D Render",
  travel: "Ultra-Portable Travel",
  fitness: "Athletics & Biometrics",
  outdoor: "Rugged Outdoor Endurance",
};

export function StepUseCase({ category, value, onSelect }) {
  const options = USE_CASE_OPTIONS[category] || USE_CASE_OPTIONS.smartphone;

  return (
    <div>
      <h2 className="font-serif text-2xl font-normal text-[var(--color-text)] sm:text-3xl">
        What is your primary use case?
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        SmartBuy AI recalibrates specification weights based on your everyday workload.
      </p>

      <div className="mt-8 flex flex-wrap gap-2.5">
        {options.map((opt, i) => {
          const isSelected = value === opt;
          return (
            <motion.button
              key={opt}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(opt)}
              className={cn(
                "rounded-full border px-5 py-2.5 text-xs font-semibold tracking-wide transition-all duration-200",
                isSelected
                  ? "border-[var(--color-amber)] bg-[var(--color-amber)] text-[var(--color-bg)] shadow-[0_0_20px_rgba(33,12,2,0.35)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)]/60 text-[var(--color-secondary)] hover:border-[var(--color-amber)]/40 hover:text-[var(--color-text)]"
              )}
            >
              {LABELS[opt] || opt}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
