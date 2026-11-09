import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useIntakeStore } from "../store/intakeStore";
import { api, getErrorMessage } from "../lib/api";
import { BUDGET_PRESETS } from "../lib/intakeOptions";
import { StepProgress } from "../components/intake/StepProgress";
import { StepCategory } from "../components/intake/StepCategory";
import { StepBudget } from "../components/intake/StepBudget";
import { StepUseCase } from "../components/intake/StepUseCase";
import { StepFeatures } from "../components/intake/StepFeatures";
import { Button } from "../components/ui/Button";

const STEP_LABELS = ["Category", "Budget", "Use Case", "Features"];

export default function Recommend() {
  const { step, preferences, setField, toggleFeature, nextStep, prevStep } = useIntakeStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const canProceed = [
    Boolean(preferences.category),
    true, // budget always has sensible defaults
    Boolean(preferences.useCase),
    true, // features are optional
  ][step];

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const preset = BUDGET_PRESETS[preferences.category] || BUDGET_PRESETS.smartphone;
      const { data } = await api.post("/recommendations", {
        ...preferences,
        budgetMin: preferences.budgetMin ?? preset.min,
        budgetMax: preferences.budgetMax ?? Math.round(preset.max * 0.5),
      });
      navigate(`/results/${data.recommendation._id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (step === STEP_LABELS.length - 1) {
      handleSubmit();
    } else {
      nextStep();
    }
  }

  return (
    <div className="relative min-h-[85vh] px-6 py-14">
      {/* Amber radial glow backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_15%,rgba(33,12,2,0.08),transparent_60%)]" />

      <div className="relative mx-auto max-w-2xl">
        <StepProgress steps={STEP_LABELS} currentStep={step} />

        <div className="mt-10 min-h-[440px] rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[0_16px_40px_rgba(0,0,0,0.6)] sm:p-10 relative overflow-hidden">
          {/* Subtle top amber highlight line */}
          <div className="pointer-events-none absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[var(--color-amber)]/40 to-transparent" />

          <AnimatePresence mode="wait" custom={step}>
            <motion.div
              key={step}
              custom={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 && (
                <StepCategory value={preferences.category} onSelect={(v) => setField("category", v)} />
              )}
              {step === 1 && (
                <StepBudget
                  category={preferences.category}
                  budgetMin={preferences.budgetMin}
                  budgetMax={preferences.budgetMax}
                  onChange={(min, max) => {
                    setField("budgetMin", min);
                    setField("budgetMax", max);
                  }}
                />
              )}
              {step === 2 && (
                <StepUseCase
                  category={preferences.category}
                  value={preferences.useCase}
                  onSelect={(v) => setField("useCase", v)}
                />
              )}
              {step === 3 && (
                <StepFeatures
                  category={preferences.category}
                  selected={preferences.mustHaveFeatures}
                  onToggle={toggleFeature}
                  notes={preferences.notes}
                  onNotesChange={(v) => setField("notes", v)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p className="mt-6 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-xs text-[var(--color-danger)]">
              {error}
            </p>
          )}

          <div className="mt-10 flex items-center justify-between border-t border-[var(--color-border)] pt-6">
            <Button variant="ghost" onClick={prevStep} disabled={step === 0} icon={ArrowLeft}>
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              loading={submitting}
              iconRight={step === STEP_LABELS.length - 1 ? Sparkles : ArrowRight}
            >
              {step === STEP_LABELS.length - 1 ? "Analyze & Recommend" : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
