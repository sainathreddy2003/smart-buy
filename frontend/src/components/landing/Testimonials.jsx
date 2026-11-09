import { Star, Quote } from "lucide-react";
import { Reveal } from "./Reveal";

const testimonials = [
  {
    name: "Maya R.",
    role: "Freelance Creative Director",
    quote:
      "I spent weeks lost in laptop spec comparisons. SmartBuy AI understood my video editing and color accuracy needs in one sentence — the GPU memory breakdown was spot-on.",
  },
  {
    name: "Devon K.",
    role: "Computer Science Graduate",
    quote:
      "The student coding recommendation didn't just push the most expensive chip. The RAM and battery trade-off explanations saved me from an overpriced model.",
  },
  {
    name: "Priya S.",
    role: "Endurance Athlete",
    quote:
      "Asked for accurate dual-frequency GPS and long battery life. Got a transparent 3-product shortlist with price comparison across Flipkart and Amazon.",
  },
];

export function Testimonials() {
  return (
    <section className="border-t border-[#29231D] bg-[#0A0908] py-28 relative">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[#D99A51] px-3 py-1 rounded-full border border-[#D99A51]/30 bg-[#D99A51]/10">
            Real Buyer Verdicts
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-5xl font-normal tracking-tight text-[#F5F0E8]">
            Built for buyers who despise remorse.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-[#29231D] bg-[#11100F] p-8 transition-all duration-300 hover:border-[#D99A51]/40">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 text-[#D99A51]">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star key={idx} size={13} fill="currentColor" strokeWidth={0} />
                      ))}
                    </div>
                    <Quote size={18} className="text-[#3D332B] group-hover:text-[#D99A51]/40 transition-colors" />
                  </div>
                  <p className="mt-5 text-sm leading-relaxed text-[#A39A8C]">
                    "{t.quote}"
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-3 border-t border-[#29231D] pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3D332B] bg-[#181614] text-xs font-semibold text-[#E6C18A]">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#F5F0E8]">{t.name}</p>
                    <p className="text-xs text-[#6B6358]">{t.role}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
