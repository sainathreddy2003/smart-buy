import { cn } from "../../lib/utils";

const tones = {
  accent: "bg-[#191626]/10 text-[#191626] border-[#653ad7]/30",
  amber: "bg-[#653ad7]/10 text-[#653ad7] border-[#653ad7]/40 shadow-[0_0_10px_rgba(33,12,2,0.15)]",
  copper: "bg-[#4b24b3]/15 text-[#191626] border-[#4b24b3]/40",
  neutral: "bg-[#f3f2f7] text-[#5e596c] border-[#e3e0ea]",
  success: "bg-[#24734F]/15 text-[#24734F] border-[#24734F]/30",
  danger: "bg-[#A92C34]/15 text-[#A92C34] border-[#A92C34]/30",
  violet: "bg-[#4b24b3]/15 text-[#191626] border-[#4b24b3]/40",
};

export function Badge({ children, tone = "neutral", className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone] || tones.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}
