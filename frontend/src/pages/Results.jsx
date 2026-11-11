import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Columns3, LayoutGrid, RotateCcw, Sparkles } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { PickCard } from "../components/results/PickCard";
import { ComparisonTable } from "../components/results/ComparisonTable";
import { RequirementSummary } from "../components/results/RequirementSummary";
import { ChatPanel } from "../components/chat/ChatPanel";
import { Button } from "../components/ui/Button";
import { PageLoader } from "../components/ui/Spinner";
import { ErrorState } from "../components/ui/ErrorState";
import { categoryLabel } from "../lib/utils";
import { useIntakeStore } from "../store/intakeStore";

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("cards");
  const resetIntake = useIntakeStore((s) => s.reset);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/recommendations/${id}`);
      setRecommendation(data.recommendation);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <PageLoader label="Synthesizing personalized product recommendations..." />;
  if (error) return <div className="px-6 py-16"><ErrorState message={error} onRetry={load} /></div>;
  if (!recommendation) return null;

  const picks = [...recommendation.picks].sort((a, b) => a.rank - b.rank);

  return (
    <div className="relative min-h-screen px-6 py-14">
      {/* Background radial amber ambient lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(33,12,2,0.08),transparent_55%)]" />

      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-champagne)]">
            <Sparkles size={12} className="text-[var(--color-amber)]" />
            {categoryLabel(recommendation.preferences.category)} Recommendation Report
          </span>
          <h1 className="mt-4 font-serif text-3xl font-normal tracking-tight text-[var(--color-text)] sm:text-5xl">
            Here&apos;s what we&apos;d pick for you
          </h1>
          {recommendation.summary && (
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)] sm:text-base">
              {recommendation.summary}
            </p>
          )}
        </motion.div>

        <div className="mt-8">
          <RequirementSummary
            requirement={recommendation.preferences}
            originalQuery={recommendation.originalQuery}
          />
        </div>

        {/* View switcher & reset controls */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <div className="flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-sm">
            <ToggleButton active={view === "cards"} onClick={() => setView("cards")} icon={LayoutGrid} label="Ranked Cards" />
            <ToggleButton active={view === "compare"} onClick={() => setView("compare")} icon={Columns3} label="Side-by-Side" />
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={RotateCcw}
            onClick={() => {
              resetIntake();
              navigate("/chat");
            }}
          >
            Start over
          </Button>
        </div>

        {/* Product Cards or Comparison Table */}
        <div className="mt-12">
          {view === "cards" ? (
            <div className="grid gap-6 md:grid-cols-3 md:items-start">
              {picks.map((pick, i) => (
                <PickCard key={pick.product._id} pick={pick} index={i} />
              ))}
            </div>
          ) : (
            <ComparisonTable picks={picks} />
          )}
        </div>
      </div>

      <ChatPanel key={recommendation._id} recommendationId={recommendation._id} />
    </div>
  );
}

function ToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all duration-200 ${
        active
          ? "bg-[var(--color-amber)] text-[var(--color-bg)] font-semibold shadow-[0_0_15px_rgba(33,12,2,0.35)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}
