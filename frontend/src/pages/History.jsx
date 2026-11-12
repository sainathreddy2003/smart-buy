import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, ArrowUpRight, Sparkles } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { PageLoader } from "../components/ui/Spinner";
import { ErrorState } from "../components/ui/ErrorState";

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/history");
      setHistory(data.history || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <PageLoader label="Loading query log..." />;
  if (error) return <div className="px-6 py-16"><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div className="relative mx-auto max-w-3xl px-6 py-14">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(33,12,2,0.06),transparent_60%)]" />

      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-champagne)]">
          <Sparkles size={11} className="text-[var(--color-amber)]" />
          Query Chronology
        </span>
        <h1 className="mt-3 font-serif text-3xl font-normal tracking-tight text-[var(--color-text)] sm:text-5xl">
          Search History
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Revisit past inquiries and re-open generated recommendation reports.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center text-xs text-[var(--color-text-muted)] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <Clock size={28} className="mx-auto mb-3 text-[var(--color-text-faint)]" />
          No recent searches logged — ask WiseBuy for a product recommendation to get started.
        </div>
      ) : (
        <div className="mt-8 space-y-2.5">
          {history.map((entry, i) => (
            <motion.button
              key={entry._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.03 }}
              onClick={() => entry.recommendation && navigate(`/results/${entry.recommendation._id}`)}
              disabled={!entry.recommendation}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-left transition-all duration-200 hover:border-[var(--color-amber)]/40 hover:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-60 group shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-amber)]">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-champagne)] transition-colors">
                    {entry.query}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-text-faint)]">
                    {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {entry.resultCount ? ` · ${entry.resultCount} curated picks` : ""}
                  </p>
                </div>
              </div>
              {entry.recommendation && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-faint)] group-hover:border-[var(--color-amber)] group-hover:text-[var(--color-champagne)] transition-colors">
                  <ArrowUpRight size={14} />
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
