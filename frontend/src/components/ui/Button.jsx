import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const variants = {
  primary:
    "bg-[#191626] text-white font-semibold hover:bg-[#4b24b3] active:scale-[0.98]",
  secondary:
    "bg-[#f3f2f7] text-[#191626] border border-[#e3e0ea] hover:border-[#653ad7]/50 hover:bg-[#edeaf6] hover:text-[#191626]",
  ghost:
    "text-[#5e596c] hover:text-[#191626] hover:bg-[#f3f2f7]",
  danger:
    "bg-[#A92C34]/15 text-[#A92C34] border border-[#A92C34]/30 hover:bg-[#A92C34]/25",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs rounded-md",
  md: "px-4.5 py-2.5 text-sm rounded-lg",
  lg: "px-6 py-3.5 text-base rounded-xl font-medium",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
  loading,
  icon: Icon,
  iconRight: IconRight,
  ...props
}) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.015 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none",
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        Icon && <Icon size={15} strokeWidth={2.2} />
      )}
      {children}
      {!loading && IconRight && <IconRight size={15} strokeWidth={2.2} />}
    </motion.button>
  );
}
