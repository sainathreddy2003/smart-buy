import { useState } from "react";
import { TrendingDown, TrendingUp, Calendar, Info } from "lucide-react";
import { formatPrice } from "../../lib/utils";

export function PriceHistoryChart({ history }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!history || !history.entries || history.entries.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] p-8 text-center">
        <Info size={24} className="mx-auto text-[#696378]" />
        <p className="mt-3 text-sm text-[#5e596c]">No recorded price history for this product yet.</p>
        <p className="mt-1 text-xs text-[#696378]">We automatically track live price drops as new seller listings are verified.</p>
      </div>
    );
  }

  const { entries, low, high, current, changePercent } = history;
  const dropped = changePercent != null && changePercent < 0;

  const prices = entries.map((e) => e.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const svgWidth = 600;
  const svgHeight = 160;
  const paddingX = 24;
  const paddingY = 24;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const points = entries.map((e, i) => {
    const x = paddingX + (i / Math.max(entries.length - 1, 1)) * chartWidth;
    const y = svgHeight - paddingY - ((e.price - minPrice) / priceRange) * chartHeight;
    return { x, y, price: e.price, date: e.date };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${points[0]?.x || 0},${svgHeight - paddingY} ${polylinePoints} ${points[points.length - 1]?.x || 0},${svgHeight - paddingY}`;

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : points[points.length - 1];

  return (
    <div className="rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] p-6 shadow-sm">
      {/* Header Stat Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-b border-[#e3e0ea] pb-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#696378]">Current Best</p>
          <p className="mt-1 font-display text-2xl text-[#191626] tracking-tight">{formatPrice(current)}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#696378]">30-Day Lowest</p>
          <p className="mt-1 font-display text-2xl text-[#24734F] tracking-tight">{formatPrice(low)}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#696378]">30-Day Highest</p>
          <p className="mt-1 font-display text-2xl text-[#5e596c] tracking-tight">{formatPrice(high)}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#696378]">30-Day Volatility</p>
          <div className="mt-1 flex items-center gap-1.5">
            {dropped ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#24734F]">
                <TrendingDown size={16} /> {Math.abs(changePercent)}% drop
              </span>
            ) : changePercent > 0 ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#653ad7]">
                <TrendingUp size={16} /> +{changePercent}% rise
              </span>
            ) : (
              <span className="text-sm font-medium text-[#5e596c]">Stable pricing</span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart Canvas */}
      <div className="relative mt-6">
        {/* Floating Tooltip Indicator */}
        {activePoint && (
          <div
            className="absolute top-0 z-10 -translate-x-1/2 -translate-y-8 rounded-lg border border-[#653ad7]/40 bg-[#f3f2f7] px-2.5 py-1 text-xs text-[#191626] shadow-lg pointer-events-none transition-all duration-150"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
            }}
          >
            <span className="font-semibold text-[#191626]">{formatPrice(activePoint.price)}</span>
            {activePoint.date && (
              <span className="ml-1.5 text-[10px] text-[#5e596c]">
                {new Date(activePoint.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-44 overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="amberPriceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#653ad7" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#191626" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#fafafc" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Reference Gridlines */}
          <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#e3e0ea" strokeDasharray="4 4" strokeWidth="1" />
          <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="#e3e0ea" strokeDasharray="4 4" strokeWidth="1" />
          <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#e3e0ea" strokeWidth="1" />

          {/* Shaded Area under Curve */}
          <polygon points={areaPoints} fill="url(#amberPriceGradient)" />

          {/* Smooth Golden Price Line */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#653ad7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Hover Hotspots & Dots */}
          {points.map((p, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <g key={idx}>
                {/* Visual Point */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5.5 : 3}
                  fill={isHovered ? "#191626" : "#653ad7"}
                  stroke="#fafafc"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />

                {/* Larger invisible hitbox for effortless hover */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Timeline Footnote */}
      <div className="mt-4 flex items-center justify-between text-[11px] text-[#696378] border-t border-[#e3e0ea]/60 pt-3">
        <span className="flex items-center gap-1">
          <Calendar size={12} /> 30-day recorded window
        </span>
        <span>Hover across points to inspect historical prices</span>
      </div>
    </div>
  );
}
