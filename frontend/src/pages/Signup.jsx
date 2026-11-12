import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { AuthShell } from "../components/layout/AuthShell";
import { Field } from "./Login";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", form);
      setSession(data.user, data.accessToken);
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join WiseBuy to synchronize your recommendations across devices and unlock customized product tracking."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          icon={User}
          type="text"
          placeholder="Jordan Lee"
          label="Full Name"
          minLength={2}
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          required
        />
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
          placeholder="At least 8 characters"
          label="Password"
          minLength={8}
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
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-[var(--color-champagne)] hover:text-[var(--color-amber)] hover:underline">
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
