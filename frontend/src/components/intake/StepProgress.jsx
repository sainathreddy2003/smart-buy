import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export function StepProgress({ steps, currentStep }) {
  return (
    <div className="mx-auto flex w-full max-w-lg items-center px-4">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300",
                i < currentStep &&
                  "border-[var(--color-amber)] bg-[var(--color-amber)] text-[var(--color-bg)] font-bold shadow-[0_0_12px_rgba(33,12,2,0.3)]",
                i === currentStep &&
                  "border-[var(--color-amber)] bg-[var(--color-amber)]/15 text-[var(--color-champagne)] shadow-[0_0_14px_rgba(33,12,2,0.4)] ring-2 ring-[var(--color-amber)]/20",
                i > currentStep &&
                  "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-faint)]"
              )}
            >
              {i < currentStep ? <Check size={14} strokeWidth={2.5} /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden text-[11px] font-medium tracking-wide uppercase sm:block transition-colors",
                i <= currentStep ? "text-[var(--color-champagne)]" : "text-[var(--color-text-faint)]"
              )}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="mx-3 h-0.5 flex-1 bg-[var(--color-border)]">
              <motion.div
                className="h-full bg-[var(--color-amber)] shadow-[0_0_8px_rgba(33,12,2,0.5)]"
                initial={{ width: "0%" }}
                animate={{ width: i < currentStep ? "100%" : "0%" }}
                transition={{ duration: 0.4 }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
