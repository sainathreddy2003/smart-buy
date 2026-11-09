import { cn } from "../../lib/utils";

export function Spinner({ className, size = 20 }) {
  return (
    <span
      className={cn("inline-block rounded-full border-2 border-[#653ad7]/20 border-t-[#191626] animate-spin", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function PageLoader({ label = "Loading intelligence..." }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-[#5e596c]">
      <div className="relative flex items-center justify-center">
        <span className="h-10 w-10 rounded-full border-2 border-[#e3e0ea] border-t-[#653ad7] border-r-[#191626] animate-spin shadow-[0_0_20px_rgba(33,12,2,0.25)]" />
        <span className="absolute h-4 w-4 rounded-full bg-[#653ad7]/20 blur-sm" />
      </div>
      <p className="text-xs font-medium tracking-wider uppercase text-[#191626]">{label}</p>
    </div>
  );
}
