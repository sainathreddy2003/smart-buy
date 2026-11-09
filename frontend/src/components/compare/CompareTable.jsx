import { Link } from "react-router-dom";
import { formatPrice, onImageError } from "../../lib/utils";

const FORMATTERS = {
  price: (v) => formatPrice(v),
  rating: (v) => `${v} / 5.0`,
  gb: (v) => `${v} GB`,
  tier: (v) => `Tier ${v} / 5`,
  score: (v) => `${v} / 5.0`,
  hours: (v) => `${v} hrs`,
};

function formatValue(value, format) {
  if (value == null) return "—";
  return (FORMATTERS[format] || ((v) => v))(value);
}

export function CompareTable({ products, comparison }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] shadow-sm">
      <table className="w-full min-w-[620px] border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-[#e3e0ea] bg-[#f3f2f7]">
            <th className="sticky left-0 z-20 bg-[#f3f2f7] px-6 py-5 text-left font-semibold uppercase tracking-wider text-[#5e596c] text-xs">
              Specification
            </th>
            {products.map((p) => (
              <th key={p._id} className="px-6 py-5 text-left min-w-[200px]">
                <Link to={`/catalog/${p._id}`} className="group block">
                  <div className="flex h-20 w-auto items-center justify-center p-2 mb-3 bg-[#fafafc] rounded-xl border border-[#e3e0ea]">
                    <img
                      src={p.images?.[0]}
                      alt={p.name}
                      onError={onImageError}
                      className="max-h-full max-w-full object-contain filter drop-shadow transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <p className="font-display text-base font-normal text-[#191626] group-hover:text-[#191626] transition-colors line-clamp-1">
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#653ad7] uppercase tracking-wider">
                    {p.brand}
                  </p>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row, i) => (
            <tr
              key={row.key}
              className={`border-b border-[#e3e0ea]/80 transition-colors ${
                i % 2 === 0 ? "bg-[#FFFFFF]" : "bg-[#f3f2f7]/60"
              } hover:bg-[#edeaf6]`}
            >
              <td className="sticky left-0 z-10 bg-[#FFFFFF] px-6 py-4 font-medium text-[#5e596c]">
                {row.label}
              </td>
              {row.values.map((v) => (
                <td
                  key={v.productId}
                  className={`px-6 py-4 font-mono ${
                    v.isBest
                      ? "font-semibold text-[#191626] bg-[#653ad7]/5"
                      : "text-[#191626]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{formatValue(v.value, row.format)}</span>
                    {v.isBest && (
                      <span className="rounded bg-[#653ad7]/20 px-1.5 py-0.2 text-[10px] font-bold text-[#191626]" title="Winning Value">
                        ★ BEST
                      </span>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
