"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../lib/supabase/client";

type AuthMode = "login" | "signup";

type AuthPanelProps = {
  mode: AuthMode;
};

export function AuthPanel({ mode }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const next = searchParams.get("next") ?? "/workspace";
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-3xl border border-white/15 bg-white/5 p-8">
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="text-sm text-white/60">
        {mode === "login"
          ? "Sign in to keep building LaTeX-ready notes."
          : "Get started and unlock pro templates when you are ready."}
      </p>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-white/70" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-white/70" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="rounded-xl border border-rose/50 bg-rose/20 p-3 text-sm text-rose-100">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-white px-4 py-2 font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
      >
        {loading ? "Loading..." : mode === "login" ? "Sign in" : "Sign up"}
      </button>
    </form>
  );
}
