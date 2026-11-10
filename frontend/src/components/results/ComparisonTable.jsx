import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { formatPrice } from "../../lib/utils";

export function ComparisonTable({ picks }) {
  const specKeys = Array.from(new Set(picks.flatMap((p) => Object.keys(p.product.specs || {}))));

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
    >
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <th className="sticky left-0 z-10 w-44 bg-[var(--color-surface-2)] px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
              Specification
            </th>
            {picks.map((pick) => (
              <th key={pick.product._id} className="px-6 py-5 text-left min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--color-amber)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-champagne)]">
                    Rank #{pick.rank}
                  </span>
                </div>
                <p className="mt-1.5 font-semibold text-sm text-[var(--color-text)] line-clamp-1">
                  {pick.product.name}
                </p>
                <p className="mt-1 text-base font-bold text-[var(--color-champagne)] font-serif">
                  {formatPrice(pick.product.bestPrice)}
                </p>
                <Link
                  to={`/catalog/${pick.product._id}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-amber)] hover:underline"
                >
                  View Details <ArrowUpRight size={11} />
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {/* Match Score */}
          {picks.some(({ matchScore }) => matchScore != null) && <tr className="bg-[var(--color-surface)]">
            <td className="sticky left-0 z-10 bg-[var(--color-surface)] px-6 py-3.5 font-semibold text-[var(--color-champagne)]">
              Match Score
            </td>
            {picks.map((pick) => (
              <td key={pick.product._id} className="px-6 py-3.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-amber)]/10 px-2.5 py-1 text-xs font-bold text-[var(--color-amber)]">
                  {pick.matchScore == null ? "—" : `${pick.matchScore} / 100`}
                </span>
              </td>
            ))}
          </tr>}

          {/* Rating */}
          <tr className="bg-[var(--color-surface)]/60">
            <td className="sticky left-0 z-10 bg-[var(--color-surface)] px-6 py-3.5 text-[var(--color-text-faint)]">
              Customer Rating
            </td>
            {picks.map((pick) => (
              <td key={pick.product._id} className="px-6 py-3.5 text-[var(--color-secondary)]">
                ★ {pick.product.rating ? pick.product.rating.toFixed(1) : "—"} / 5{" "}
                <span className="text-[var(--color-text-faint)]">
                  ({pick.product.reviewCount || 0} reviews)
                </span>
              </td>
            ))}
          </tr>

          {/* Specs */}
          {specKeys.map((key, i) => (
            <tr
              key={key}
              className={i % 2 === 0 ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-2)]/30"}
            >
              <td className="sticky left-0 z-10 bg-inherit px-6 py-3.5 font-medium text-[var(--color-text-muted)]">
                {key}
              </td>
              {picks.map((pick) => (
                <td key={pick.product._id} className="px-6 py-3.5 text-[var(--color-secondary)]">
                  {pick.product.specs?.[key] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
