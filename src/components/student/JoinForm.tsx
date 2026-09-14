"use client";

import { actionJoin } from "@/app/actions/student";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function JoinForm({ presetCode = "" }: { presetCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(presetCode);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await actionJoin(code, username);
          if (!result.ok) setError(result.error);
          else router.push(`/s/${result.code}`);
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-feed-muted">
          Room code
        </span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full border-b border-white/20 bg-transparent py-2 font-mono text-2xl tracking-[0.3em] outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-feed-muted">
          Username
        </span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={16}
          autoComplete="off"
          className="w-full border-b border-white/20 bg-transparent py-2 text-lg outline-none"
        />
        <span className="mt-2 block text-xs text-feed-muted">
          (do not use real name)
        </span>
      </label>
      {error && <p className="text-sm text-feed-accent">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-feed-accent py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
      >
        Enter the feed
      </button>
    </form>
  );
}
