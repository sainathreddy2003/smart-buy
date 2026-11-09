import { Link } from "react-router-dom";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/Button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[75vh] flex-col items-center justify-center px-6 text-center">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_40%,rgba(33,12,2,0.08),transparent_60%)]" />

      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-champagne)]">
        <Sparkles size={11} className="text-[var(--color-amber)]" />
        Signal Interrupted
      </span>

      <p className="mt-6 font-serif text-8xl font-normal tracking-tight text-[var(--color-champagne)]">
        404
      </p>
      <h1 className="mt-4 font-serif text-2xl font-normal text-[var(--color-text)] sm:text-3xl">
        This device wandered off the radar.
      </h1>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-[var(--color-text-muted)]">
        The product specification or page you requested could not be located in our index.
      </p>
      <Link to="/" className="mt-8">
        <Button icon={ArrowLeft}>
          Return to Platform Home
        </Button>
      </Link>
    </div>
  );
}
