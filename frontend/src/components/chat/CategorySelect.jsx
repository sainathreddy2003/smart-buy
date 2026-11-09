import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

const CATEGORIES = [
  { id: "all", name: "All Hardware", icon: "⚡" },
  { id: "laptop", name: "Laptops", icon: "💻" },
  { id: "smartphone", name: "Smartphones", icon: "📱" },
  { id: "headphones", name: "Headphones", icon: "🎧" },
  { id: "smartwatch", name: "Smartwatches", icon: "⌚" },
  { id: "monitor", name: "Monitors", icon: "🖥️" },
  { id: "tablet", name: "Tablets", icon: "📱" },
];

export function CategorySelect({ value = "all", onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedCategory = CATEGORIES.find((c) => c.id === value) || CATEGORIES[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between gap-2 rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] px-3 h-8.5 min-w-[135px] text-xs text-[#191626] transition-colors hover:border-[#653ad7]/40 hover:bg-[#edeaf6] focus:outline-none cursor-pointer"
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-xs">{selectedCategory.icon}</span>
          <span className="font-medium truncate">{selectedCategory.name}</span>
        </div>
        <ChevronDown
          size={13}
          className={`text-[#5e596c] transition-transform duration-200 flex-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 z-50 min-w-[170px] overflow-hidden rounded-xl border border-[#e3e0ea] bg-[#FFFFFF]/98 p-1 shadow-sm backdrop-blur-xl"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#696378]">
              Filter Hardware
            </div>
            {CATEGORIES.map((cat) => {
              const isSelected = cat.id === selectedCategory.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onChange?.(cat.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#f3f2f7] text-[#191626] font-medium border border-[#e3e0ea]"
                      : "text-[#5e596c] hover:bg-[#f3f2f7]/60 hover:text-[#191626]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </div>
                  {isSelected && <Check size={13} className="text-[#653ad7] flex-none" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
