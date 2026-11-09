import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="relative flex min-h-[85vh] items-center justify-center overflow-hidden px-6 py-16">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,rgba(33,12,2,0.09),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.7)] sm:p-10 overflow-hidden"
      >
        {/* Top subtle highlight */}
        <div className="pointer-events-none absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[var(--color-amber)]/40 to-transparent" />

        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 text-[var(--color-champagne)] shadow-[0_0_15px_rgba(33,12,2,0.25)]">
            <Sparkles size={20} className="text-[var(--color-amber)]" />
          </span>
          <h1 className="mt-5 font-serif text-3xl font-normal text-[var(--color-text)]">
            {title}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
