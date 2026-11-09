import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, Star, Check, Columns3, Sparkles } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { formatPrice, categoryLabel, onImageError } from "../lib/utils";
import { PageLoader } from "../components/ui/Spinner";
import { ErrorState } from "../components/ui/ErrorState";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ProductCard } from "../components/catalog/ProductCard";
import { PriceComparison } from "../components/product/PriceComparison";
import { PriceHistoryChart } from "../components/product/PriceHistoryChart";
import { YouTubeReviews } from "../components/product/YouTubeReviews";
import { AppleProductModal } from "../components/product/AppleProductModal";
import { useAuthStore } from "../store/authStore";
import { useFavoritesStore } from "../store/favoritesStore";
import { useCompareStore } from "../store/compareStore";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [priceHistory, setPriceHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeColor, setActiveColor] = useState(null);
  const [showAppleModal, setShowAppleModal] = useState(false);

  const user = useAuthStore((s) => s.user);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const { ids: compareIds, toggle: toggleCompare } = useCompareStore();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: productData }, { data: relatedData }, { data: historyData }] = await Promise.all([
        api.get(`/products/${id}`),
        api.get(`/products/${id}/related`),
        api.get(`/products/${id}/history`),
      ]);
      setProduct(productData.product);
      setActiveColor(productData.product.colors?.[0] || null);
      setRelated(relatedData.products);
      setPriceHistory(historyData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <PageLoader label="Fetching product intelligence..." />;
  if (error) return <div className="px-6 py-16"><ErrorState message={error} onRetry={load} /></div>;
  if (!product) return null;

  const favorite = isFavorite(product._id);
  const compared = compareIds.includes(product._id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link
        to="/catalog"
        className="inline-flex items-center gap-2 text-xs font-medium text-[#5e596c] transition-colors hover:text-[#191626]"
      >
        <ArrowLeft size={14} /> Back to catalog
      </Link>

      {/* Main Product Showcase Grid */}
      <div className="mt-8 grid gap-12 lg:grid-cols-2 items-start">
        {/* Left: Product Hero Media Stage */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative flex items-center justify-center rounded-3xl border border-[#e3e0ea] bg-[#FFFFFF] p-10 sm:p-14 shadow-sm overflow-hidden min-h-[380px] sm:min-h-[460px]"
        >
          {/* Subtle amber studio rim ambient glow */}
          <div className="pointer-events-none absolute inset-0 bg-radial-ambient opacity-40" />

          <img
            src={product.images?.[0]}
            alt={product.name}
            className="max-h-80 w-auto object-contain filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-10"
            onError={onImageError}
          />
        </motion.div>

        {/* Right: Specifications & Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col"
        >
          <div className="flex items-center gap-2">
            <Badge tone="accent">{categoryLabel(product.category)}</Badge>
            <Badge tone="neutral">{product.brand}</Badge>
          </div>

          <h1 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#191626]">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-[#5e596c] leading-relaxed">{product.tagline}</p>

          <div className="mt-4 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 bg-[#f3f2f7] px-3 py-1 rounded-full border border-[#e3e0ea]">
              <Star size={13} fill="currentColor" className="text-[#653ad7]" />
              <span className="font-semibold text-[#191626]">{product.rating}</span>
              <span className="text-[#696378]">({product.reviewCount} customer reviews)</span>
            </div>
          </div>

          {/* Price */}
          <div className="mt-6 flex items-baseline gap-3 border-t border-[#e3e0ea] pt-5">
            <span className="font-display text-4xl font-normal text-[#191626] tracking-tight">
              {formatPrice(product.bestPrice)}
            </span>
            {product.sellers?.[0] && (
              <span className="text-xs text-[#5e596c]">
                best price on {product.sellers[0].platform}
              </span>
            )}
          </div>

          <p className="mt-4 text-xs sm:text-sm leading-relaxed text-[#5e596c]">
            {product.description}
          </p>

          {/* Color Finishes */}
          {product.colors?.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#696378]">Available Finishes</p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setActiveColor(color)}
                    className={`rounded-lg border px-3.5 py-1.5 text-xs transition-colors cursor-pointer ${
                      activeColor === color
                        ? "border-[#653ad7] bg-[#653ad7]/15 text-[#191626] font-semibold"
                        : "border-[#e3e0ea] bg-[#f3f2f7] text-[#5e596c] hover:text-[#191626]"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Key Feature Highlights */}
          {product.features?.length > 0 && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 border-t border-[#e3e0ea] pt-5">
              {product.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-xs text-[#191626]">
                  <Check size={14} className="flex-none text-[#653ad7]" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Row */}
          <div className="mt-8 flex flex-wrap gap-3 pt-2">
            {user && (
              <Button
                variant={favorite ? "danger" : "secondary"}
                icon={Heart}
                size="sm"
                onClick={() => toggleFavorite(product)}
              >
                {favorite ? "Saved to Wishlist" : "Save Product"}
              </Button>
            )}
            <Button
              variant={compared ? "danger" : "secondary"}
              icon={Columns3}
              size="sm"
              onClick={() => toggleCompare(product._id)}
            >
              {compared ? "Remove from Compare" : "Compare Specs"}
            </Button>
            <Button
              variant="secondary"
              icon={Sparkles}
              size="sm"
              onClick={() => setShowAppleModal(true)}
            >
              3D Showcase
            </Button>
            <Link to="/chat">
              <Button variant="primary" size="sm">
                Ask AI Advisor
              </Button>
            </Link>
          </div>

          {compareIds.length > 0 && (
            <button
              type="button"
              onClick={() => navigate("/compare")}
              className="mt-3.5 text-xs font-semibold text-[#191626] hover:underline cursor-pointer text-left"
            >
              View Side-by-Side Matrix ({compareIds.length} devices selected) →
            </button>
          )}
        </motion.div>
      </div>

      {/* Multi-Seller Live Price Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-20"
      >
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[#653ad7]">Live Market Deals</span>
        <h2 className="mt-2 font-display text-2xl sm:text-3xl text-[#191626] tracking-tight">Multi-seller price comparison</h2>
        <div className="mt-5">
          <PriceComparison sellers={product.sellers} />
        </div>
      </motion.div>

      {/* Interactive 30-Day Price History Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-20"
      >
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[#653ad7]">Market Volatility</span>
        <h2 className="mt-2 font-display text-2xl sm:text-3xl text-[#191626] tracking-tight">30-day price trend & history</h2>
        <div className="mt-5">
          <PriceHistoryChart history={priceHistory} />
        </div>
      </motion.div>

      {/* Full Spec Sheet Table */}
      {product.specs && Object.keys(product.specs).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20"
        >
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[#653ad7]">Hardware Architecture</span>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl text-[#191626] tracking-tight">Complete specifications sheet</h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] shadow-sm">
            {Object.entries(product.specs).map(([key, value], i) => (
              <div
                key={key}
                className={`grid grid-cols-2 px-6 py-4 text-xs sm:text-sm border-b border-[#e3e0ea]/70 last:border-b-0 ${
                  i % 2 === 0 ? "bg-[#FFFFFF]" : "bg-[#f3f2f7]/60"
                }`}
              >
                <span className="font-medium text-[#5e596c]">{key}</span>
                <span className="font-mono text-[#191626]">{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* YouTube Review Discovery */}
      <div className="mt-20">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[#653ad7]">Verified Hands-On</span>
        <h2 className="mt-2 font-display text-2xl sm:text-3xl text-[#191626] tracking-tight">Watch video reviews before you buy</h2>
        <div className="mt-5">
          <YouTubeReviews query={`${product.brand} ${product.name}`} />
        </div>
      </div>

      {/* Related Products Grid */}
      {related.length > 0 && (
        <div className="mt-20 border-t border-[#e3e0ea] pt-14">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[#653ad7]">Ecosystem Alternatives</span>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl text-[#191626] tracking-tight">Similar hardware in this budget</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard key={p._id} product={p} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Interactive Modal */}
      <AppleProductModal
        product={product}
        isOpen={showAppleModal}
        onClose={() => setShowAppleModal(false)}
      />
    </div>
  );
}
