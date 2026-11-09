import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export function Card({ children, className, hover = false, ...props }) {
  return (
    <motion.div
      whileHover={hover ? { y: -6 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        hover && "hover:border-[var(--color-accent)]/40 transition-colors duration-300",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
