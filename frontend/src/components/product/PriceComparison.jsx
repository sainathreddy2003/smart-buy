import { ExternalLink, Tag } from "lucide-react";
import { formatPrice } from "../../lib/utils";

export function PriceComparison({ sellers }) {
  if (!sellers?.length) {
    return <p className="text-sm text-[#5e596c]">No eligible offers from Amazon India, Flipkart, or Croma.</p>;
  }
  const sorted = [...sellers].sort((a, b) => a.price - b.price);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] shadow-sm">
      {sorted.map((seller, i) => (
        <div
          key={seller.platform}
          className={`flex items-center justify-between gap-4 px-6 py-4 text-xs sm:text-sm border-b border-[#e3e0ea]/80 last:border-b-0 transition-colors ${
            i === 0 ? "bg-[#f3f2f7]" : "bg-[#FFFFFF] hover:bg-[#f3f2f7]/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="font-medium text-[#191626]">{seller.platform}</span>
            {i === 0 && (
              <span className="rounded-full bg-[#653ad7]/20 border border-[#653ad7]/40 px-2.5 py-0.5 text-[10px] font-semibold text-[#191626] flex items-center gap-1 shadow-sm">
                <Tag size={10} /> Best Price
              </span>
            )}
            {!seller.availability && (
              <span className="text-xs text-[#696378] border border-[#e3e0ea] px-2 py-0.5 rounded-full">
                Out of Stock
              </span>
            )}
          </div>
          <div className="flex items-center gap-5">
            <span
              className={`font-mono text-base ${
                i === 0 ? "font-bold text-[#191626]" : "text-[#5e596c]"
              }`}
            >
              {formatPrice(seller.price)}
            </span>
            <a
              href={seller.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] px-3 py-1.5 text-xs font-medium text-[#5e596c] transition-all hover:border-[#653ad7]/50 hover:bg-[#edeaf6] hover:text-[#191626] cursor-pointer"
            >
              <span>View Deal</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
