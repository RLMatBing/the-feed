"use client";

import { formatBytes } from "@/lib/format";
import { composeEnergyCost } from "@/lib/media-cost";
import { useEffect, useState } from "react";

type GiphyHit = {
  id: string;
  title: string;
  preview: string;
  size: number;
};

export function GifPicker({
  basePost,
  baseReply,
  isReply,
  onPick,
  onClose,
}: {
  basePost: number;
  baseReply: number;
  isReply: boolean;
  onPick: (gif: GiphyHit) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    const handle = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/gifs?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
        signal: ac.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            gifs?: GiphyHit[];
            error?: string;
          };
          if (!response.ok) throw new Error(payload.error || "Could not search GIFs.");
          setGifs(payload.gifs ?? []);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof Error ? err.message : "Could not search GIFs.");
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, query.trim() ? 350 : 0);
    return () => {
      ac.abort();
      window.clearTimeout(handle);
    };
  }, [query]);

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIPHY"
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
        G-rated results only. Still must be classroom-appropriate.
      </p>
      {error && <p className="mt-2 text-[11px] text-feed-accent">{error}</p>}
      <div className="mt-3 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
        {loading && gifs.length === 0 ? (
          <p className="col-span-3 py-8 text-center text-xs text-feed-muted">
            Searching…
          </p>
        ) : gifs.length === 0 ? (
          <p className="col-span-3 py-8 text-center text-xs text-feed-muted">
            No GIFs for that.
          </p>
        ) : (
          gifs.map((gif) => {
            const cost = composeEnergyCost(basePost, baseReply, isReply, {
              size: gif.size,
              type: "image/gif",
              name: "giphy.gif",
            });
            return (
              <button
                key={gif.id}
                type="button"
                onClick={() => onPick(gif)}
                className="overflow-hidden rounded-lg bg-white/5"
                title={`${gif.title} · ${cost} Energy`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="h-20 w-full object-cover"
                />
                <span className="block truncate px-1 py-1 text-[10px] text-feed-muted">
                  {formatBytes(gif.size)} · {cost}E
                </span>
              </button>
            );
          })
        )}
      </div>
      <p className="mt-2 text-center text-[10px] tracking-wide text-feed-muted">
        Powered by GIPHY
      </p>
    </div>
  );
}
