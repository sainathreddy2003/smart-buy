import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Star, ExternalLink, Heart, Columns3 } from "lucide-react";
import { formatPrice, categoryLabel, onImageError } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";
import { useFavoritesStore } from "../../store/favoritesStore";
import { useCompareStore } from "../../store/compareStore";

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

export function AppleProductModal({ product, isOpen, onClose }) {
  const titleId = useId();
  const [expandedFeature, setExpandedFeature] = useState(null);
  const [selectedColor, setSelectedColor] = useState(0);

  const user = useAuthStore((s) => s.user);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const { isSelected, toggle: toggleCompare } = useCompareStore();

  if (!isOpen || !product) return null;

  const favorite = isFavorite(product._id);
  const compared = isSelected(product._id);

  const colors = product.colors?.length
    ? product.colors
    : ["Space Gray", "Silver", "Midnight"];

  const features = product.features?.length
    ? product.features.map((f, i) => {
        const parts = f.includes(":") ? f.split(":") : [f, f];
        return {
          id: `feat-${i}`,
          title: parts[0].trim(),
          description: parts.slice(1).join(":").trim() || parts[0].trim(),
        };
      })
    : Object.entries(product.specs || {}).map(([key, val], i) => ({
        id: `spec-${i}`,
        title: key.charAt(0).toUpperCase() + key.slice(1),
        description: String(val),
      }));

  const activeColorName = colors[selectedColor] || colors[0];
  const productImage = product.images?.[selectedColor % (product.images?.length || 1)] || product.images?.[0];

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 md:p-8">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-xl"
        />

        {/* Modal Window */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="relative w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] md:max-h-[calc(100dvh-4rem)] overflow-hidden rounded-3xl border border-[#e3e0ea] bg-[#fafafc] text-[#191626] shadow-sm z-10 flex flex-col"
        >
          {/* Top Bar with Controls */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#e3e0ea] bg-[#FFFFFF] px-4 py-4 sm:px-6 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-full bg-[#653ad7]/15 border border-[#653ad7]/30 px-2.5 py-0.5 text-xs font-semibold text-[#191626]">
                {categoryLabel(product.category)}
              </span>
              <span className="truncate text-xs uppercase tracking-wider text-[#5e596c] font-medium">{product.brand}</span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {user && (
                <button
                  type="button"
                  onClick={() => toggleFavorite(product)}
                  className={`flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] transition-colors cursor-pointer ${
                    favorite ? "text-[#A92C34] border-[#A92C34]/40" : "text-[#5e596c] hover:text-[#191626]"
                  }`}
                  title={favorite ? "Saved to Favorites" : "Save to Favorites"}
                >
                  <Heart size={14} fill={favorite ? "currentColor" : "none"} />
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleCompare(product._id)}
                className={`flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] transition-colors cursor-pointer ${
                  compared ? "text-[#191626] border-[#653ad7]/50 bg-[#653ad7]/10" : "text-[#5e596c] hover:text-[#191626]"
                }`}
                title="Compare Spec-by-Spec"
              >
                <Columns3 size={14} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] text-[#5e596c] hover:text-[#191626] hover:bg-[#edeaf6] transition-colors ml-2 cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body: Split View Layout */}
          <div className="grid min-h-0 lg:grid-cols-[400px_1fr] flex-1 overflow-y-auto">
            {/* Left Column: Feature Cards & Color Selector */}
            <div className="flex flex-col gap-3.5 p-5 sm:p-6 overflow-y-auto border-r border-[#e3e0ea] bg-[#FFFFFF]">
              {/* Product Title & Price Card */}
              <div className="bg-[#f3f2f7] border border-[#e3e0ea] rounded-2xl p-5 shadow-lg">
                <h2 id={titleId} className="font-display text-2xl font-normal tracking-tight text-[#191626]">{product.name}</h2>
                <p className="text-xs text-[#5e596c] mt-1.5 line-clamp-2 leading-relaxed">{product.tagline || product.description}</p>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#e3e0ea]">
                  <span className="text-2xl font-bold text-[#191626] tracking-tight">{formatPrice(product.bestPrice)}</span>
                  <div className="flex items-center gap-1 text-xs text-[#5e596c] bg-[#edeaf6] px-2.5 py-1 rounded-full border border-[#e3e0ea]">
                    <Star size={11} fill="currentColor" className="text-[#653ad7]" />
                    <span>{product.rating}</span>
                    <span className="text-[#696378]">({product.reviewCount})</span>
                  </div>
                </div>
              </div>

              {/* Color Selector Card */}
              <div className="bg-[#f3f2f7] border border-[#e3e0ea] rounded-2xl p-5 shadow-lg">
                <h3 className="text-xs text-[#191626] font-semibold uppercase tracking-wider mb-1">
                  Finish: <span className="text-[#191626] normal-case font-normal">{activeColorName}</span>
                </h3>
                <div className="flex gap-2 flex-wrap mt-3">
                  {colors.map((colorName, idx) => {
                    const normalized = colorName.toLowerCase().trim();
                    const hex = COLOR_MAP[normalized] || "#52525b";
                    const isCurrent = selectedColor === idx;
                    return (
                      <button
                        key={colorName}
                        type="button"
                        onClick={() => setSelectedColor(idx)}
                        title={colorName}
                        className={`w-8 h-8 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                          isCurrent
                            ? "ring-2 ring-[#191626] ring-offset-2 ring-offset-[#f3f2f7] scale-105"
                            : "hover:scale-105 opacity-70 hover:opacity-100 border border-white/10"
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Expandable Feature Accordions */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[#696378] px-1 pt-1">
                  Hardware Specifications & Highlights
                </p>
                {features.map((feature, index) => {
                  const isExpanded = expandedFeature === feature.id;

                  return (
                    <motion.div
                      key={feature.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-[#f3f2f7] border border-[#e3e0ea] rounded-xl overflow-hidden transition-all duration-300"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFeature(isExpanded ? null : feature.id)}
                        className="w-full justify-between bg-transparent hover:bg-[#edeaf6] text-[#191626] px-4 py-3 flex items-center transition-all duration-200 text-left cursor-pointer"
                      >
                        <span className="text-xs font-medium leading-snug">{feature.title}</span>
                        <motion.div
                          animate={{ rotate: isExpanded ? 45 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex-none ml-2 text-[#191626]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </motion.div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 pt-1 border-t border-[#e3e0ea]/80">
                              <p className="text-xs text-[#5e596c] leading-relaxed break-words whitespace-normal">
                                {feature.description}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Hero Product Visual & Live Sellers */}
            <div className="relative flex flex-col items-center justify-between p-6 sm:p-10 bg-[#fafafc] min-h-[380px]">
              {/* Product Visual */}
              <div className="flex-1 w-full flex items-center justify-center relative my-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${product._id}-${selectedColor}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="flex items-center justify-center w-full max-w-md h-64 sm:h-80"
                  >
                    <img
                      src={productImage}
                      alt={product.name}
                      onError={onImageError}
                      className="max-h-full max-w-full object-contain filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)]"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Multi-seller Best Price Bar */}
              <div className="w-full max-w-md bg-[#FFFFFF] border border-[#e3e0ea] rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#191626] mb-2.5">Live Seller Comparison</p>
                <div className="space-y-2">
                  {product.sellers?.slice(0, 3).map((seller) => (
                    <a
                      key={seller.platform}
                      href={seller.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#f3f2f7] hover:bg-[#edeaf6] border border-[#e3e0ea] hover:border-[#653ad7]/40 transition-colors text-xs"
                    >
                      <span className="font-medium text-[#191626]">{seller.platform}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#191626]">{formatPrice(seller.price)}</span>
                        <ExternalLink size={12} className="text-[#5e596c]" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
