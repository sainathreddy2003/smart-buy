import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, History, ArrowUpRight, Sparkles } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { formatPrice, categoryLabel } from "../lib/utils";
import { useFavoritesStore } from "../store/favoritesStore";
import { ProductCard } from "../components/catalog/ProductCard";
import { PageLoader } from "../components/ui/Spinner";
import { ErrorState } from "../components/ui/ErrorState";
import { cn } from "../lib/utils";

export default function Favorites() {
  const [tab, setTab] = useState("favorites");
  const { items, loading, error, fetchFavorites } = useFavoritesStore();

  useEffect(() => {
    fetchFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative mx-auto max-w-7xl px-6 py-14">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(33,12,2,0.06),transparent_60%)]" />

      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-champagne)]">
          <Sparkles size={11} className="text-[var(--color-amber)]" />
          Member Sanctuary
        </span>
        <h1 className="mt-3 font-serif text-3xl font-normal tracking-tight text-[var(--color-text)] sm:text-5xl">
          Saved Products &amp; History
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Your bookmarked technology and past AI recommendation sessions in one place.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-6 border-b border-[var(--color-border)]">
        <TabButton active={tab === "favorites"} onClick={() => setTab("favorites")} icon={Heart}>
          Saved Products ({items.length})
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={History}>
          Recommendation History
        </TabButton>
      </div>

      <div className="mt-8">
        {tab === "favorites" ? (
          loading ? (
            <PageLoader label="Fetching your saved products..." />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchFavorites} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No saved products yet"
              message="Explore the catalog or chat with the AI assistant, then tap the heart icon on any device to save it here."
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((product, i) => (
                <ProductCard key={product._id} product={product} index={i} />
              ))}
            </div>
          )
        ) : (
          <RecommendationHistory />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 pb-3.5 text-xs font-semibold uppercase tracking-wider transition-colors",
        active
          ? "text-[var(--color-champagne)]"
          : "text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
      )}
    >
      <Icon size={14} className={active ? "text-[var(--color-amber)]" : ""} />
      <span>{children}</span>
      {active && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-amber)] shadow-[0_0_8px_rgba(33,12,2,0.6)]"
        />
      )}
    </button>
  );
}

function EmptyState({ icon: Icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-20 px-6 text-center shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-amber)]">
        <Icon size={22} />
      </div>
      <h3 className="mt-2 text-base font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="max-w-md text-xs leading-relaxed text-[var(--color-text-muted)]">{message}</p>
    </div>
  );
}

function RecommendationHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get("/recommendations/history");
        setHistory(data.recommendations);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <PageLoader label="Retrieving recommendation archive..." />;
  if (error) return <ErrorState message={error} />;
  if (history.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No recommendation history"
        message="Use the guided advisor or start a conversation in AI Chat to generate your first intelligent shortlist."
      />
    );
  }

  return (
    <div className="space-y-3">
      {history.map((rec, i) => (
        <motion.div
          key={rec._id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Link
            to={`/results/${rec._id}`}
            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all duration-200 hover:border-[var(--color-amber)]/40 hover:bg-[var(--color-surface-2)] group shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-amber)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-champagne)]">
                  {categoryLabel(rec.preferences?.category)}
                </span>
                <span className="text-[11px] text-[var(--color-text-faint)]">
                  {new Date(rec.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
                Top recommendation:{" "}
                <span className="text-[var(--color-champagne)]">
                  {rec.picks[0]?.product?.name || "Product"}
                </span>{" "}
                <span className="text-[var(--color-text-faint)] font-normal">
                  ({formatPrice(rec.picks[0]?.product?.price || 0)})
                </span>
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-faint)] transition-colors group-hover:border-[var(--color-amber)] group-hover:text-[var(--color-champagne)]">
              <ArrowUpRight size={15} />
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
