import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Heart, ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";
import { MatchGauge } from "./MatchGauge";
import { formatPrice, onImageError } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";
import { useFavoritesStore } from "../../store/favoritesStore";
import { cn } from "../../lib/utils";

const RANK_CONFIG = {
  1: {
    label: "Top Recommendation",
    badgeBg: "bg-[var(--color-amber)]/15 border-[var(--color-amber)]/40 text-[var(--color-champagne)]",
    cardBorder: "border-[var(--color-amber)]/50 shadow-[0_0_30px_-5px_rgba(33,12,2,0.2)] md:-translate-y-4",
    highlight: true,
  },
  2: {
    label: "Runner-Up",
    badgeBg: "bg-[var(--color-copper)]/15 border-[var(--color-copper)]/40 text-[var(--color-copper)]",
    cardBorder: "border-[var(--color-border)] shadow-[0_12px_28px_rgba(0,0,0,0.6)]",
    highlight: false,
  },
  3: {
    label: "Alternative Value",
    badgeBg: "bg-white/5 border-[var(--color-border)] text-[var(--color-text-muted)]",
    cardBorder: "border-[var(--color-border)] shadow-[0_12px_28px_rgba(0,0,0,0.6)]",
    highlight: false,
  },
};

export function PickCard({ pick, index }) {
  const { product, matchScore, rankingSource, reasoning, tradeoffs, rank } = pick;
  const config = RANK_CONFIG[rank] || RANK_CONFIG[3];
  const user = useAuthStore((s) => s.user);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favorite = isFavorite(product._id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 35, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative flex flex-col rounded-2xl border bg-[var(--color-surface)] p-6 transition-all duration-300",
        config.cardBorder
      )}
    >
      {/* Top Badge & Favorite */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide uppercase",
            config.badgeBg
          )}
        >
          {config.highlight && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber)] animate-pulse" />}
          {rankingSource === "groq" ? "Camera shortlist" : config.label}
        </span>
        {user && (
          <button
            onClick={() => toggleFavorite(product)}
            aria-label="Toggle favorite"
            className="rounded-full p-2 text-[var(--color-text-faint)] transition-colors hover:bg-white/5 hover:text-[var(--color-copper)]"
          >
            <Heart
              size={17}
              fill={favorite ? "currentColor" : "none"}
              className={favorite ? "text-[var(--color-copper)]" : ""}
            />
          </button>
        )}
      </div>

      {/* Product Image in Dark Stage */}
      <div className="relative mt-5 flex h-44 w-full items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 overflow-hidden group">
        <div className="pointer-events-none absolute inset-0 bg-radial-gradient from-[var(--color-amber)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <img
          src={product.images?.[0]}
          alt={product.name}
          className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={onImageError}
        />
      </div>

      {/* Product Title, Price, & Match Gauge */}
      <div className="mt-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-faint)]">
            {product.brand}
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-[var(--color-text)]">
            {product.name}
          </h3>
          <p className="mt-2 text-xl font-bold tracking-tight text-[var(--color-champagne)] font-serif">
            {formatPrice(product.bestPrice)}
          </p>
        </div>
        {matchScore != null && <MatchGauge score={matchScore} />}
      </div>

      {/* AI Reasoning */}
      <div className="mt-4 flex-1">
        <div className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
          <CheckCircle2 size={14} className="mt-0.5 flex-none text-[var(--color-amber)]" />
          <span>{reasoning}</span>
        </div>

        {tradeoffs && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-2.5 text-[11px] leading-relaxed text-[var(--color-secondary)]">
            <AlertCircle size={13} className="mt-0.5 flex-none text-[var(--color-amber)]" />
            <span><strong className="text-[var(--color-text-muted)]">Trade-off:</strong> {tradeoffs}</span>
          </div>
        )}
      </div>

      {/* Footer Link */}
      <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
        <Link
          to={`/catalog/${product._id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-champagne)] transition-colors hover:text-[var(--color-amber)] group"
        >
          Inspect technical specs
          <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        {product.rating && (
          <span className="text-[11px] font-medium text-[var(--color-text-faint)]">
            ★ {product.rating.toFixed(1)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
