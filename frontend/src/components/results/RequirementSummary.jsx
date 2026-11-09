import { Check, Sparkles } from "lucide-react";
import { categoryLabel, formatPrice } from "../../lib/utils";

function buildBullets(requirement) {
  const bullets = [];
  if (requirement.category) bullets.push(categoryLabel(requirement.category));
  if (requirement.budget?.max) bullets.push(`Budget ≤ ${formatPrice(requirement.budget.max)}`);
  if (requirement.useCases?.length) bullets.push(`Target use: ${requirement.useCases.join(", ")}`);

  const reqs = requirement.requirements || {};
  if (reqs.ram?.minimum) bullets.push(`${reqs.ram.minimum}GB+ RAM threshold`);
  if (reqs.storage?.minimum) bullets.push(`${reqs.storage.minimum}GB+ high-speed NVMe storage`);
  if (reqs.gpu?.required) bullets.push("Dedicated discrete GPU");
  if (reqs.anc?.required) bullets.push("Active noise cancellation (ANC)");
  if (reqs.battery?.minimum) bullets.push(`${reqs.battery.minimum}h+ extended battery runtime`);
  if (reqs.portability?.important) bullets.push("High portability / slim profile");

  return bullets;
}

export function RequirementSummary({ requirement, originalQuery }) {
  if (!requirement) return null;
  const bullets = buildBullets(requirement);

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-left shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:p-7">
      {originalQuery && (
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-[var(--color-amber)]" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
              Your Request
            </p>
          </div>
          <p className="mt-2 text-lg font-serif italic text-[var(--color-text)] sm:text-xl">
            &ldquo;{originalQuery}&rdquo;
          </p>
        </div>
      )}

      {bullets.length > 0 && (
        <div className={originalQuery ? "mt-5 pt-5 border-t border-[var(--color-border)]" : ""}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
            AI Requirement Synthesis
          </p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-surface-2)]/70 px-3 py-2 text-xs text-[var(--color-secondary)]"
              >
                <Check size={13} className="flex-none text-[var(--color-amber)]" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
