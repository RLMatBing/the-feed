"use client";

import { actionCreateSession } from "@/app/actions/instructor";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ConsoleHome({
  sessions,
}: {
  sessions: { id: string; code: string; status: string; currentRound: number }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="min-h-[100dvh] bg-ops-bg px-6 py-16 text-ops-text">
      <p className="font-mono text-[11px] uppercase tracking-wide text-white">
        Operator console
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Rooms</h1>
      <p className="mt-2 max-w-md text-sm text-ops-muted">
        Start a new classroom, or reopen one you already ran.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await actionCreateSession();
            if (!result.ok) setError(result.error);
            else router.push(`/console/${result.id}`);
          })
        }
        className="mt-8 bg-white px-4 py-2 font-mono text-xs uppercase tracking-wide text-black active:scale-[0.98]"
      >
        New room
      </button>
      {error && <p className="mt-3 text-sm text-neutral-400">{error}</p>}
      <ul className="mt-10 space-y-2">
        {sessions.map((session) => (
          <li key={session.id}>
            <a
              href={`/console/${session.id}`}
              className="block border border-ops-line px-4 py-3 font-mono text-sm hover:border-white"
            >
              {session.code} · {session.status} · round {session.currentRound}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
