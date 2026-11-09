import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Reveal } from "./Reveal";

export function CTA() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-[#050505] py-28 border-t border-[#29231D]">
      {/* Studio radial warmth */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(33,12,2,0.08),transparent)]" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D99A51]/30 bg-[#11100F] px-3.5 py-1 text-xs font-medium text-[#E6C18A] shadow-[0_0_15px_rgba(33,12,2,0.15)]">
            <Sparkles size={12} className="text-[#D99A51]" />
            <span className="uppercase tracking-widest text-[10px] font-semibold">Immediate Intelligence</span>
          </span>

          <h2 className="mt-6 font-display text-4xl sm:text-6xl font-normal tracking-tight text-[#F5F0E8]">
            Stop scrolling spec sheets.
            <br />
            <span className="text-gradient italic">Start getting answers.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-lg text-base sm:text-lg leading-relaxed text-[#A39A8C]">
            It takes less time than reading one more review. Let SmartBuy AI evaluate the hardware, compare live sellers, and shortlist your top picks.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="rounded-xl border border-[#D99A51]/80 bg-gradient-to-r from-[#D99A51] via-[#E6C18A] to-[#D99A51] bg-[length:200%_auto] px-7 py-3.5 text-sm font-semibold text-[#050505] shadow-[0_0_25px_rgba(33,12,2,0.3)] hover:shadow-[0_0_35px_rgba(33,12,2,0.5)] hover:brightness-105 transition-all cursor-pointer flex items-center gap-2 active:scale-[0.98]"
            >
              <span>Launch AI Advisor</span>
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate("/recommend")}
              className="rounded-xl border border-[#29231D] bg-[#11100F] px-6 py-3.5 text-sm font-medium text-[#F5F0E8] hover:border-[#D99A51]/50 hover:bg-[#181614] hover:text-[#E6C18A] transition-all cursor-pointer"
            >
              Try Guided Step Flow
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
