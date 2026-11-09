export function MatchGauge({ score = 0, size = 56 }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-border-strong)"
          strokeWidth="3.5"
          fill="none"
          opacity="0.6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-amber)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
            filter: "drop-shadow(0 0 6px rgba(217, 154, 81, 0.45))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-sans text-xs font-bold text-[var(--color-champagne)]">
          {score}
        </span>
        <span className="text-[8px] uppercase tracking-wider text-[var(--color-text-faint)] -mt-0.5">
          pts
        </span>
      </div>
    </div>
  );
}
