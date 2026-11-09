import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { AuthShell } from "../components/layout/AuthShell";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      setSession(data.user, data.accessToken);
      navigate(location.state?.from?.pathname || "/");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to access your curated product bookmarks, custom price alerts, and recommendation reports."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          icon={Mail}
          type="email"
          placeholder="you@domain.com"
          label="Email Address"
          value={form.email}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          required
        />
        <Field
          icon={Lock}
          type="password"
          placeholder="••••••••••••"
          label="Password"
          value={form.password}
          onChange={(v) => setForm((f) => ({ ...f, password: v }))}
          required
        />

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3.5 py-2.5 text-xs text-[var(--color-danger)]"
          >
            {error}
          </motion.p>
        )}

        <Button type="submit" className="w-full mt-2" size="lg" loading={loading} iconRight={ArrowRight}>
          Sign In
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
        New to SmartBuy AI?{" "}
        <Link to="/signup" className="font-semibold text-[var(--color-champagne)] hover:text-[var(--color-amber)] hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function Field({ icon: Icon, label, value, onChange, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
        {label}
      </span>
      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-3.5 py-2.5 transition-colors focus-within:border-[var(--color-amber)] focus-within:ring-1 focus-within:ring-[var(--color-amber)]/30">
        <Icon size={16} className="text-[var(--color-text-faint)]" />
        <input
          className="w-full bg-transparent text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      </div>
    </label>
  );
}
