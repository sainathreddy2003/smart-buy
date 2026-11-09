import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PackageSearch, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { FilterBar } from "../components/catalog/FilterBar";
import { ProductCard } from "../components/catalog/ProductCard";
import { PageLoader } from "../components/ui/Spinner";
import { ErrorState } from "../components/ui/ErrorState";
import { Button } from "../components/ui/Button";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    category: searchParams.get("category") || "",
    search: searchParams.get("search") || "",
    sort: searchParams.get("sort") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
  });
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const debouncedSearch = useDebouncedValue(filters.search);
  const debouncedMin = useDebouncedValue(filters.minPrice);
  const debouncedMax = useDebouncedValue(filters.maxPrice);

  function updateFilters(partial) {
    setFilters((f) => ({ ...f, ...partial }));
    setPage(1);
  }

  useEffect(() => {
    const params = {};
    if (filters.category) params.category = filters.category;
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.sort) params.sort = filters.sort;
    if (debouncedMin) params.minPrice = debouncedMin;
    if (debouncedMax) params.maxPrice = debouncedMax;
    setSearchParams(params, { replace: true });

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get("/products", { params: { ...params, page, limit: 12 } });
        setProducts(data.products);
        setPagination(data.pagination);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.sort, debouncedSearch, debouncedMin, debouncedMax, page]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#653ad7]/30 bg-[#f3f2f7] px-3 py-0.5 text-xs font-semibold text-[#191626] uppercase tracking-wider">
          <Sparkles size={11} className="text-[#653ad7]" />
          Verified Catalog
        </span>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl font-normal tracking-tight text-[#191626]">
          Curated hardware catalog.
        </h1>
        <p className="mt-3 text-base text-[#5e596c]">
          Browse verified specifications across top electronics categories, compare live multi-seller pricing, or use the AI advisor to find your exact match.
        </p>
      </motion.div>

      {/* Filter Bar */}
      <div className="mt-8">
        <FilterBar filters={filters} onChange={updateFilters} />
      </div>

      {/* Results Grid / States */}
      <div className="mt-10">
        {loading ? (
          <PageLoader label="Fetching products from catalog..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setPage(page)} />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#ccc6dc] bg-[#f3f2f7] text-[#696378]">
              <PackageSearch size={24} />
            </div>
            <h3 className="mt-2 text-base font-semibold text-[#191626]">No products match those criteria</h3>
            <p className="text-xs text-[#5e596c]">Try widening your price range or clearing category filters.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product, i) => (
                <ProductCard key={product._id} product={product} index={i} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-3 border-t border-[#e3e0ea] pt-8">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              icon={ChevronLeft}
            >
              Previous
            </Button>
            <span className="text-xs font-medium text-[#5e596c] px-3">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => {
                setPage((p) => p + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              iconRight={ChevronRight}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
