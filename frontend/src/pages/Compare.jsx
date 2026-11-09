import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { X, Columns3, Trophy, Sparkles, Trash2, ArrowRight } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { useCompareStore } from "../store/compareStore";
import { PageLoader } from "../components/ui/Spinner";
import { ErrorState } from "../components/ui/ErrorState";
import { CompareTable } from "../components/compare/CompareTable";
import { Button } from "../components/ui/Button";

export default function Compare() {
  const { ids, toggle, clear } = useCompareStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    if (ids.length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: response } = await api.post("/products/compare", { productIds: ids });
      setData(response);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  if (ids.length < 2) {
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e3e0ea] bg-[#f3f2f7] text-[#191626] shadow-[0_0_30px_rgba(33,12,2,0.2)]">
          <Columns3 size={28} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-normal tracking-tight text-[#191626]">
          Compare Side-by-Side
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5e596c]">
          Add 2 to 4 products from the catalog or your recommendations, then come back here to evaluate spec-by-spec differences and calculated verdicts.
        </p>
        <Link to="/catalog" className="mt-8">
          <Button variant="primary" iconRight={ArrowRight}>
            Explore Products to Compare
          </Button>
        </Link>
      </div>
    );
  }

  if (loading) return <PageLoader label="Synthesizing comparison matrix..." />;
  if (error) return <div className="px-6 py-16"><ErrorState message={error} onRetry={load} /></div>;
  if (!data) return null;

  const bestProduct = data.products.find((p) => p._id === data.bestChoice.productId);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#653ad7]/30 bg-[#f3f2f7] px-3 py-0.5 text-xs font-semibold text-[#191626] uppercase tracking-wider">
            <Sparkles size={11} className="text-[#653ad7]" />
            Direct Hardware Matrix
          </span>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl font-normal tracking-tight text-[#191626]">
            Side-by-side comparison.
          </h1>
          <p className="mt-2 text-sm text-[#5e596c]">
            Deterministic spec benchmarking across {data.products.length} selected devices. Winning attributes are highlighted in gold.
          </p>
        </div>

        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] px-3 py-1.5 text-xs text-[#5e596c] hover:border-[#A92C34]/40 hover:text-[#A92C34] transition-colors cursor-pointer"
        >
          <Trash2 size={13} />
          <span>Clear All ({data.products.length})</span>
        </button>
      </div>

      {/* Selected Product Chips */}
      <div className="mt-6 flex flex-wrap gap-2">
        {data.products.map((p) => (
          <span
            key={p._id}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e3e0ea] bg-[#FFFFFF] px-3.5 py-1.5 text-xs text-[#191626] shadow-sm"
          >
            <span className="font-medium">{p.name}</span>
            <button
              type="button"
              onClick={() => toggle(p._id)}
              aria-label={`Remove ${p.name}`}
              className="text-[#696378] hover:text-[#A92C34] transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>

      {/* Deterministic Winner Banner */}
      {bestProduct && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 rounded-2xl border border-[#653ad7]/40 bg-gradient-to-r from-[#f3f2f7] via-[#edeaf6] to-[#f3f2f7] p-6 shadow-[0_0_30px_rgba(33,12,2,0.15)]"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#653ad7]">
            <Trophy size={15} />
            <span>Calculated Best Match</span>
          </div>
          <p className="mt-2 font-display text-2xl text-[#191626] tracking-tight">{bestProduct.name}</p>
          <p className="mt-1 text-sm text-[#5e596c]">
            Wins <strong className="text-[#191626]">{data.bestChoice.winCount}</strong> of {data.bestChoice.totalRows} compared specifications across normalized performance, RAM, storage, and price value.
          </p>
        </motion.div>
      )}

      {/* Comparison Table */}
      <div className="mt-8">
        <CompareTable products={data.products} comparison={data.comparison} />
      </div>
    </div>
  );
}
