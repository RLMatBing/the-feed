"use client";

import { GIF_ENERGY } from "@/lib/media-cost";
import { useEffect, useState } from "react";

type GiphyHit = {
  id: string;
  title: string;
  preview: string;
};

export function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: GiphyHit) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const q = query.trim();
    setLoading(true);
    setError(null);
    if (q) setGifs([]);

    const handle = window.setTimeout(() => {
      fetch(`/api/gifs?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            gifs?: GiphyHit[];
            error?: string;
          };
          if (!response.ok) {
            throw new Error(payload.error || "Could not search GIFs.");
          }
          setGifs(payload.gifs ?? []);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setGifs([]);
          setError(err instanceof Error ? err.message : "Could not search GIFs.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, q ? 200 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [query]);

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
      <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a word — cat, sports, lecture…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-feed-muted"
          autoFocus
        />
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-semibold text-feed-muted"
        >
          Close
        </button>
      </div>
      <p className="mt-2 text-[11px] text-feed-muted">
        G-rated GIPHY results. Each GIF costs {GIF_ENERGY} Energy. Still must
        be classroom-appropriate.
      </p>
      {error && <p className="mt-2 text-[11px] text-feed-accent">{error}</p>}
      <div className="relative mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
        {loading && gifs.length === 0 ? (
          <p className="col-span-3 py-8 text-center text-xs text-feed-muted">
            Searching…
          </p>
        ) : gifs.length === 0 ? (
          <p className="col-span-3 py-8 text-center text-xs text-feed-muted">
            No GIFs for that. Try a simpler word.
          </p>
        ) : (
          gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              onClick={() => onPick(gif)}
              className="overflow-hidden rounded-lg bg-white/5"
              title={`${gif.title} · ${GIF_ENERGY} Energy`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gif.preview}
                alt={gif.title}
                referrerPolicy="no-referrer"
                className="h-24 w-full bg-white/5 object-cover"
              />
            </button>
          ))
        )}
      </div>
      <p className="mt-2 text-center text-[10px] tracking-wide text-feed-muted">
        Powered by GIPHY
      </p>
    </div>
  );
}
