import { Search, ArrowUpDown } from "lucide-react";
import { CATEGORY_OPTIONS } from "../../lib/intakeOptions";
import { cn } from "../../lib/utils";

const SORT_OPTIONS = [
  { value: "", label: "Default: Best Match" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating-desc", label: "Top Customer Rating" },
];

export function FilterBar({ filters, onChange }) {
  return (
    <div className="space-y-5 rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] p-5 shadow-sm">
      {/* Search Bar Input */}
      <div className="flex items-center gap-3 rounded-xl border border-[#e3e0ea] bg-[#f3f2f7] px-4 py-2.5 transition-all duration-200 focus-within:border-[#653ad7]/60 focus-within:shadow-[0_0_20px_rgba(33,12,2,0.15)]">
        <Search size={16} className="text-[#5e596c]" />
        <input
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search by brand, model, chip, or specification..."
          className="w-full bg-transparent text-sm text-[#191626] outline-none placeholder:text-[#696378]"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ category: "" })}
          className={cn(
            "rounded-lg border px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer",
            !filters.category
              ? "border-[#653ad7]/80 bg-gradient-to-r from-[#653ad7] to-[#191626] text-white shadow-[0_0_15px_rgba(33,12,2,0.25)]"
              : "border-[#e3e0ea] bg-[#f3f2f7] text-[#5e596c] hover:border-[#653ad7]/40 hover:text-[#191626]"
          )}
        >
          All Tech
        </button>
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ category: opt.value })}
            className={cn(
              "rounded-lg border px-3.5 py-1.5 text-xs font-medium tracking-wide transition-all duration-200 cursor-pointer",
              filters.category === opt.value
                ? "border-[#653ad7]/80 bg-gradient-to-r from-[#653ad7] to-[#191626] text-white font-semibold shadow-[0_0_15px_rgba(33,12,2,0.25)]"
                : "border-[#e3e0ea] bg-[#f3f2f7] text-[#5e596c] hover:border-[#653ad7]/40 hover:text-[#191626]"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sorting & Price Range Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e0ea]/80 pt-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filters.sort}
              onChange={(e) => onChange({ sort: e.target.value })}
              className="appearance-none rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] pl-8 pr-8 py-2 text-xs font-medium text-[#191626] outline-none transition-colors hover:border-[#653ad7]/40 focus:border-[#653ad7] cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#f3f2f7] text-[#191626]">
                  {opt.label}
                </option>
              ))}
            </select>
            <ArrowUpDown size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5e596c]" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#696378]">Budget:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min ₹"
              value={filters.minPrice}
              onChange={(e) => onChange({ minPrice: e.target.value })}
              className="w-24 rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] px-2.5 py-1.5 text-xs text-[#191626] outline-none placeholder:text-[#696378] focus:border-[#653ad7]/60"
            />
            <span className="text-[#696378]">—</span>
            <input
              type="number"
              placeholder="Max ₹"
              value={filters.maxPrice}
              onChange={(e) => onChange({ maxPrice: e.target.value })}
              className="w-24 rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] px-2.5 py-1.5 text-xs text-[#191626] outline-none placeholder:text-[#696378] focus:border-[#653ad7]/60"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
