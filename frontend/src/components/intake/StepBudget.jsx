import { useMemo } from "react";
import { BUDGET_PRESETS } from "../../lib/intakeOptions";
import { formatPrice } from "../../lib/utils";

export function StepBudget({ category, budgetMin, budgetMax, onChange }) {
  const preset = BUDGET_PRESETS[category] || BUDGET_PRESETS.smartphone;

  const min = budgetMin ?? preset.min;
  const max = budgetMax ?? Math.round(preset.max * 0.5);

  const percentMin = useMemo(() => ((min - preset.min) / (preset.max - preset.min)) * 100, [min, preset]);
  const percentMax = useMemo(() => ((max - preset.min) / (preset.max - preset.min)) * 100, [max, preset]);

  return (
    <div>
      <h2 className="font-serif text-2xl font-normal text-[var(--color-text)] sm:text-3xl">
        What is your investment range?
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        WiseBuy optimizes for best value-to-performance within your designated budget.
      </p>

      <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-6 sm:p-8">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
              Minimum Threshold
            </p>
            <p className="mt-1 font-serif text-2xl font-bold text-[var(--color-champagne)] sm:text-3xl">
              {formatPrice(min)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
              Target Ceiling
            </p>
            <p className="mt-1 font-serif text-2xl font-bold text-[var(--color-amber)] sm:text-3xl">
              {formatPrice(max)}
            </p>
          </div>
        </div>

        <div className="relative mt-10 h-2">
          {/* Base Track */}
          <div className="absolute inset-0 rounded-full bg-[var(--color-surface-3)]" />
          {/* Active Range Track */}
          <div
            className="absolute h-2 rounded-full bg-gradient-to-r from-[var(--color-copper)] via-[var(--color-amber)] to-[var(--color-champagne)] shadow-[0_0_10px_rgba(33,12,2,0.5)]"
            style={{ left: `${percentMin}%`, right: `${100 - percentMax}%` }}
          />
          <input
            type="range"
            min={preset.min}
            max={preset.max}
            step={preset.step}
            value={min}
            onChange={(e) => onChange(Math.min(Number(e.target.value), max - preset.step), max)}
            className="range-thumb pointer-events-none absolute inset-0 h-2 w-full appearance-none bg-transparent"
          />
          <input
            type="range"
            min={preset.min}
            max={preset.max}
            step={preset.step}
            value={max}
            onChange={(e) => onChange(min, Math.max(Number(e.target.value), min + preset.step))}
            className="range-thumb pointer-events-none absolute inset-0 h-2 w-full appearance-none bg-transparent"
          />
        </div>

        <div className="mt-5 flex justify-between text-xs font-mono text-[var(--color-text-faint)]">
          <span>{formatPrice(preset.min)}</span>
          <span>{formatPrice(preset.max)}+</span>
        </div>
      </div>

      <style>{`
        .range-thumb {
          pointer-events: none;
        }
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: var(--color-amber);
          border: 2px solid var(--color-champagne);
          box-shadow: 0 0 12px rgba(217, 154, 81, 0.6);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .range-thumb::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: var(--color-amber);
          border: 2px solid var(--color-champagne);
          box-shadow: 0 0 12px rgba(217, 154, 81, 0.6);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
