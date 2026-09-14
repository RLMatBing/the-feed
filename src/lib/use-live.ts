"use client";

import { useEffect, useState } from "react";

export function useLiveState<T>(
  sessionId: string,
  role: "student" | "admin",
  initial: T,
): T {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const response = await fetch(
          `/api/state?sessionId=${encodeURIComponent(sessionId)}&role=${role}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as T;
        if (!cancelled) setState(payload);
      } catch {
        // ignore transient network errors
      }
    }

    const source = new EventSource(
      `/api/stream?sessionId=${encodeURIComponent(sessionId)}&role=${role}`,
    );
    source.onmessage = (event) => {
      try {
        if (!cancelled) setState(JSON.parse(event.data) as T);
      } catch {
        // ignore malformed frames
      }
    };

    void pull();
    const poll = setInterval(() => {
      void pull();
    }, 1200);

    return () => {
      cancelled = true;
      source.close();
      clearInterval(poll);
    };
  }, [sessionId, role]);

  return state;
}
