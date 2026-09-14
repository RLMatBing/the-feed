"use client";

import { actionInstructorLogin } from "@/app/actions/instructor";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await actionInstructorLogin(password);
          if (!result.ok) setError(result.error);
          else router.push("/console");
        });
      }}
    >
      <label className="block">
        <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-ops-muted">
          Access key
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-ops-line bg-transparent px-3 py-2 font-mono text-sm outline-none"
        />
      </label>
      {error && <p className="font-mono text-xs text-neutral-400">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-white px-4 py-2 font-mono text-xs uppercase tracking-wide text-black active:scale-[0.98]"
      >
        Authenticate
      </button>
    </form>
  );
}
