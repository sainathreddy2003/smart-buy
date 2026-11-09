import { useState } from "react";
import { TrendingDown, TrendingUp, Calendar } from "lucide-react";
import { formatPrice } from "../../lib/utils";

const observationDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});
const observationTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
});

export function PriceHistoryChart({ history }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const entries = history?.entries ?? [];
  const isDemo = entries.some((entry) => entry.source === "seed");

  if (entries.length < 2) {
    const first = entries[0];
    return (
      <div className="rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#191626]">
          <Calendar size={16} className="text-[#653ad7]" />
          {first ? (isDemo ? "Demo price observation" : "One recorded price") : "No prices recorded in the last 30 days"}
        </div>
        {first && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-2xl text-[#191626]">{formatPrice(first.price)}</span>
            <time className="text-sm text-[#5e596c]" dateTime={first.timestamp}>
              {observationDate.format(new Date(first.timestamp))}
            </time>
          </div>
        )}
        <p className="mt-2 text-sm text-[#5e596c]">The chart appears once there are two price observations in this window.</p>
      </div>
    );
  }

  const { low, high, current, changePercent } = history;
  const dropped = changePercent != null && changePercent < 0;
  const priceRange = high - low;
  const firstTime = new Date(entries[0].timestamp).getTime();
  const lastTime = new Date(entries.at(-1).timestamp).getTime();
  const timeRange = lastTime - firstTime;

  const svgWidth = 600;
  const svgHeight = 160;
  const paddingX = 24;
  const paddingY = 24;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const points = entries.map(({ price, timestamp }) => {
    const elapsed = new Date(timestamp).getTime() - firstTime;
    const x = timeRange ? paddingX + (elapsed / timeRange) * chartWidth : svgWidth / 2;
    const y = priceRange ? svgHeight - paddingY - ((price - low) / priceRange) * chartHeight : svgHeight / 2;
    return { x, y, price, timestamp };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${points[0]?.x || 0},${svgHeight - paddingY} ${polylinePoints} ${points[points.length - 1]?.x || 0},${svgHeight - paddingY}`;

  const activePoint = points[hoveredIndex] ?? points.at(-1);

  return (
    <div className="rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] p-6 shadow-sm">
      {/* Header Stat Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-b border-[#e3e0ea] pb-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#696378]">Latest Recorded</p>
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
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#696378]">Since Previous Check</p>
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
              <span className="text-sm font-medium text-[#5e596c]">{changePercent === 0 ? "No change" : "Unavailable"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart Canvas */}
      <div className="relative mt-6">
        {/* Floating Tooltip Indicator */}
        {activePoint && (
          <div
            className="absolute top-0 z-10 -translate-x-1/2 -translate-y-8 whitespace-nowrap rounded-lg border border-[#653ad7]/40 bg-[#f3f2f7] px-2.5 py-1 text-xs text-[#191626] shadow-lg pointer-events-none transition-all duration-150"
            style={{
              left: `clamp(5rem, ${(activePoint.x / svgWidth) * 100}%, calc(100% - 5rem))`,
            }}
          >
            <span className="font-semibold text-[#191626]">{formatPrice(activePoint.price)}</span>
            <time className="ml-1.5 text-[10px] text-[#5e596c]" dateTime={activePoint.timestamp}>
              {observationTime.format(new Date(activePoint.timestamp))}
            </time>
          </div>
        )}

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-44 overflow-visible"
          preserveAspectRatio="none"
          aria-label="Recorded prices over time"
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

          {/* Recorded price line */}
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
                  tabIndex={0}
                  aria-label={`${formatPrice(p.price)} on ${observationTime.format(new Date(p.timestamp))}`}
                  onPointerEnter={() => setHoveredIndex(idx)}
                  onPointerLeave={() => setHoveredIndex(null)}
                  onClick={() => setHoveredIndex(idx)}
                  onFocus={() => setHoveredIndex(idx)}
                  onBlur={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Timeline Footnote */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#696378] border-t border-[#e3e0ea]/60 pt-3">
        <span className="flex items-center gap-1">
          <Calendar size={12} /> {isDemo ? "Demo price history" : `${entries.length} observations in the last 30 days`}
        </span>
        <span>Hover, tap, or tab to a point to see its price and time</span>
      </div>
    </div>
  );
}
