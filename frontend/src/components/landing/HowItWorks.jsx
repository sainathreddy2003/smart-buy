import { ListChecks, BrainCircuit, Trophy } from "lucide-react";
import { Reveal } from "./Reveal";

const steps = [
  {
    icon: ListChecks,
    step: "01",
    title: "Tell us what matters",
    description:
      "A natural conversational prompt captures your budget, workflow needs, and must-have hardware priorities without tedious filters.",
  },
  {
    icon: BrainCircuit,
    step: "02",
    title: "Multi-factor spec analysis",
    description:
      "Our arithmetic recommendation engine cross-references your preferences against live market candidates using verified, deterministic scoring.",
  },
  {
    icon: Trophy,
    step: "03",
    title: "Honest shortlist & deals",
    description:
      "Walk away with the top 3 ranked picks, multi-seller prices, video reviews, and transparent trade-offs to buy with complete certainty.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative border-t border-[#29231D] bg-[#0A0908] py-28 overflow-hidden"
    >
      {/* Background radial accent */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-gradient-to-r from-[#D99A51]/5 via-[#E6C18A]/5 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[#D99A51] px-3 py-1 rounded-full border border-[#D99A51]/30 bg-[#D99A51]/10">
            The Recommendation Logic
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-5xl font-normal tracking-tight text-[#F5F0E8]">
            Three steps to confident hardware buying.
          </h2>
          <p className="mt-4 text-base text-[#A39A8C]">
            Deterministic scoring, live multi-seller price checks, and zero AI hallucinations.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.12}>
              <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-[#29231D] bg-[#11100F] p-8 transition-all duration-300 hover:border-[#D99A51]/50 hover:shadow-[0_0_30px_rgba(33,12,2,0.15)] hover:-translate-y-1">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-[#D99A51] tracking-widest">
                      PHASE {step.step}
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3D332B] bg-[#181614] text-[#E6C18A] transition-transform duration-300 group-hover:scale-110 group-hover:border-[#D99A51]/60">
                      <step.icon size={20} strokeWidth={1.8} />
                    </div>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-normal text-[#F5F0E8] tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#A39A8C]">
                    {step.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
