import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Columns3, Star, Plus, Eye } from "lucide-react";
import { formatPrice, categoryLabel, onImageError } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";
import { useFavoritesStore } from "../../store/favoritesStore";
import { useCompareStore } from "../../store/compareStore";
import { AppleProductModal } from "./AppleProductModal";

const COLOR_MAP = {
  black: "#171717",
  "space black": "#18181b",
  "space gray": "#4b5563",
  gray: "#6b7280",
  silver: "#e2e8f0",
  white: "#f8fafc",
  starlight: "#fef3c7",
  midnight: "#0f172a",
  gold: "#f59e0b",
  titanium: "#94a3b8",
  "natural titanium": "#a8a29e",
  blue: "#2563eb",
  "cosmic orange": "#f97316",
  orange: "#ea580c",
  green: "#16a34a",
  red: "#dc2626",
  purple: "#9333ea",
};

export function AppleProductCard({ product, index = 0, rank, matchScore, rankingSource, reasoning, tradeoffs }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedColor, setSelectedColor] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const user = useAuthStore((s) => s.user);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const { isSelected, toggle: toggleCompare } = useCompareStore();

  const favorite = isFavorite(product._id);
  const compared = isSelected(product._id);

  const colors = product.colors?.length ? product.colors : ["Space Gray", "Silver", "Midnight"];
  const activeColorName = colors[selectedColor] || colors[0];
  const productImage = product.images?.[selectedColor % (product.images?.length || 1)] || product.images?.[0];

  // Top features to show
  const topFeatures = product.features?.slice(0, 3) || [];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.04 }}
        className="group relative flex flex-col rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] transition-all duration-300 hover:border-[#653ad7]/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(33,12,2,0.15)] hover:-translate-y-1 overflow-hidden text-[#191626]"
      >
        {/* Top Badges & Actions */}
        <div className="absolute left-3.5 top-3.5 z-20 flex items-center gap-1.5">
          {rank ? (
            <span className="rounded-full bg-[#f3f2f7]/90 backdrop-blur-md border border-[#653ad7]/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#191626] shadow-[0_0_10px_rgba(33,12,2,0.2)]">
              {rankingSource === "groq" ? "Camera shortlist" : rank === 1 ? "Top Pick" : rank === 2 ? "Runner Up" : "Also Great"}
            </span>
          ) : (
            <span className="rounded-full bg-[#f3f2f7]/85 backdrop-blur-md border border-[#e3e0ea] px-2.5 py-0.5 text-[10px] font-semibold text-[#5e596c]">
              {categoryLabel(product.category)}
            </span>
          )}
          {matchScore && (
            <span className="rounded-full bg-[#653ad7]/15 border border-[#653ad7]/40 px-2 py-0.5 text-[10px] font-semibold text-[#191626]">
              {matchScore}% Match
            </span>
          )}
        </div>

        <div className="absolute right-3.5 top-3.5 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setShowModal(true);
            }}
            title="Interactive 3D & Spec Showcase"
            className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-[#f3f2f7]/80 border border-[#e3e0ea] text-[#5e596c] hover:text-[#191626] hover:border-[#653ad7]/40 backdrop-blur-md transition-colors cursor-pointer"
          >
            <Eye size={13} />
          </button>
          {user && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                toggleFavorite(product);
              }}
              aria-label="Toggle favorite"
              className={`flex h-7.5 w-7.5 items-center justify-center rounded-full bg-[#f3f2f7]/80 border border-[#e3e0ea] backdrop-blur-md transition-colors cursor-pointer ${
                favorite ? "text-[#A92C34] border-[#A92C34]/40" : "text-[#5e596c] hover:text-[#191626]"
              }`}
            >
              <Heart size={13} fill={favorite ? "currentColor" : "none"} />
            </button>
          )}
        </div>

        {/* Product Image Area */}
        <div className="relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#f3f2f7]/60 to-transparent p-6 h-48 sm:h-52">
          <motion.img
            key={productImage}
            src={productImage}
            alt={product.name}
            onError={onImageError}
            loading="lazy"
            initial={{ opacity: 0.85, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="max-h-full max-w-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* Card Content */}
        <div className="flex flex-1 flex-col p-5 pt-2">
          {/* Color finishes row */}
          {colors.length > 0 && (
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                {colors.slice(0, 4).map((colorName, idx) => {
                  const normalized = colorName.toLowerCase().trim();
                  const hex = COLOR_MAP[normalized] || "#52525b";
                  const isCurrent = selectedColor === idx;
                  return (
                    <button
                      key={colorName}
                      type="button"
                      onClick={() => setSelectedColor(idx)}
                      title={colorName}
                      className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${
                        isCurrent
                          ? "ring-2 ring-[#191626] ring-offset-1 ring-offset-[#FFFFFF] scale-110"
                          : "opacity-60 hover:opacity-100 hover:scale-110"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] text-[#696378] font-medium truncate max-w-[120px]">
                {activeColorName}
              </span>
            </div>
          )}

          {/* Title & Brand */}
          <div className="min-w-0">
            <p className="text-[11px] text-[#653ad7] uppercase tracking-wider font-semibold">{product.brand}</p>
            <h3 className="font-display text-lg font-normal text-[#191626] tracking-tight mt-0.5 line-clamp-1">
              {product.name}
            </h3>
            <p className="text-xs text-[#5e596c] mt-0.5 line-clamp-1">{product.tagline}</p>
          </div>

          {/* Pricing & Rating */}
          <div className="mt-3.5 flex items-center justify-between border-t border-[#e3e0ea]/80 pt-3">
            <div>
              <span className="text-lg font-bold text-[#191626] tracking-tight">
                {formatPrice(product.bestPrice)}
              </span>
              {product.sellers?.[0] && <p className="text-[10px] text-[#696378]">best price at {product.sellers[0].platform}</p>}
            </div>
            {product.rating > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#5e596c] bg-[#f3f2f7] px-2 py-0.5 rounded-full border border-[#e3e0ea]">
                <Star size={11} fill="currentColor" className="text-[#653ad7]" />
                <span>{product.rating}</span>
              </div>
            )}
          </div>
          {rank && (
            <dl className="mt-2 space-y-1 text-xs text-[#5e596c]">
              {["Amazon India", "Flipkart"].map((store) => {
                const offer = product.sellers?.find(({ platform }) => platform === store);
                return (
                  <div key={store} className="flex justify-between gap-2">
                    <dt>{store}</dt>
                    <dd>{offer ? formatPrice(offer.price) : "No verified price"}</dd>
                  </div>
                );
              })}
            </dl>
          )}

          {/* Interactive Feature Accordion */}
          <div className="mt-3 pt-2.5 border-t border-[#e3e0ea]/60">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between text-left py-1 text-xs text-[#5e596c] hover:text-[#191626] transition-colors cursor-pointer group/btn"
            >
              <span className="font-medium flex items-center gap-1.5">
                {reasoning ? "Why this matches you" : "Key Specifications"}
              </span>
              <motion.div
                animate={{ rotate: isExpanded ? 45 : 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center justify-center w-5 h-5 rounded-full bg-[#f3f2f7] border border-[#e3e0ea] text-[#191626]"
              >
                <Plus size={11} strokeWidth={2.5} />
              </motion.div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-2 text-xs text-[#5e596c] leading-relaxed bg-[#f3f2f7] p-3 rounded-xl border border-[#e3e0ea]">
                    {reasoning && (
                      <p className="text-[#191626]">{reasoning}</p>
                    )}
                    {tradeoffs && (
                      <p className="text-[#191626] text-[11px] bg-[#653ad7]/10 p-1.5 rounded-lg border border-[#653ad7]/20">
                        {tradeoffs}
                      </p>
                    )}
                    {!reasoning && topFeatures.length > 0 && (
                      <ul className="space-y-1">
                        {topFeatures.map((feat, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[#191626]">
                            <span className="text-[#653ad7]">•</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Row */}
          <div className="mt-4 flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex-1 rounded-xl bg-[#f3f2f7] hover:bg-[#edeaf6] text-[#191626] text-xs font-medium py-2 px-3 transition-colors text-center cursor-pointer border border-[#e3e0ea] hover:border-[#653ad7]/40"
            >
              Showcase
            </button>
            <Link
              to={`/catalog/${product._id}`}
              className="rounded-xl border border-[#653ad7]/80 bg-gradient-to-r from-[#653ad7] to-[#191626] text-white text-xs font-semibold py-2 px-3.5 transition-all hover:brightness-105 text-center shadow-[0_0_12px_rgba(33,12,2,0.2)]"
            >
              Details
            </Link>
            <button
              type="button"
              onClick={() => toggleCompare(product._id)}
              aria-label="Compare"
              title="Add to compare"
              className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                compared
                  ? "border-[#653ad7] bg-[#653ad7]/20 text-[#191626]"
                  : "border-[#e3e0ea] bg-[#f3f2f7] text-[#5e596c] hover:text-[#191626] hover:border-[#ccc6dc]"
              }`}
            >
              <Columns3 size={13} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Full Feature Showcase Modal */}
      <AppleProductModal
        product={product}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
