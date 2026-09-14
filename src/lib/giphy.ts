import "server-only";

import { MAX_UPLOAD_BYTES } from "./media-cost";

export type GiphyHit = {
  id: string;
  title: string;
  preview: string;
  size: number;
};

type GiphyImage = {
  url?: string;
  size?: string | number;
};

type GiphyItem = {
  id?: string;
  title?: string;
  rating?: string;
  images?: {
    preview_gif?: GiphyImage;
    downsized?: GiphyImage;
    downsized_medium?: GiphyImage;
    fixed_height?: GiphyImage;
    original?: GiphyImage;
  };
};

function apiKey(): string {
  const key = process.env.GIPHY_API_KEY?.trim();
  if (!key) throw new Error("Giphy is not configured.");
  return key;
}

export function giphyConfigured(): boolean {
  return Boolean(process.env.GIPHY_API_KEY?.trim());
}

function asSize(value: string | number | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pickPreview(item: GiphyItem): string | null {
  const images = item.images;
  return (
    images?.preview_gif?.url ||
    images?.fixed_height?.url ||
    images?.downsized?.url ||
    images?.original?.url ||
    null
  );
}

function pickPostImage(item: GiphyItem): { url: string; size: number } | null {
  const images = item.images;
  const candidates = [
    images?.downsized,
    images?.fixed_height,
    images?.downsized_medium,
    images?.original,
  ];
  for (const candidate of candidates) {
    const url = candidate?.url;
    const size = asSize(candidate?.size);
    if (!url || !isGiphyMediaUrl(url)) continue;
    if (size > 0 && size <= MAX_UPLOAD_BYTES) return { url, size };
    if (size === 0) return { url, size: 250_000 };
  }
  const fallback = images?.original?.url;
  if (fallback && isGiphyMediaUrl(fallback)) {
    return { url: fallback, size: Math.min(MAX_UPLOAD_BYTES, asSize(images?.original?.size) || 400_000) };
  }
  return null;
}

export function isGiphyMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "giphy.com" || parsed.hostname.endsWith(".giphy.com"))
    );
  } catch {
    return false;
  }
}

async function giphyGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`https://api.giphy.com/v1/${path}`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("rating", "g");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Giphy search is unavailable.");
  }
  return response.json();
}

function mapHits(items: GiphyItem[] | undefined): GiphyHit[] {
  const hits: GiphyHit[] = [];
  for (const item of items ?? []) {
    if (!item.id || item.rating && item.rating !== "g") continue;
    const preview = pickPreview(item);
    const post = pickPostImage(item);
    if (!preview || !post) continue;
    hits.push({
      id: item.id,
      title: item.title || "GIF",
      preview,
      size: post.size,
    });
  }
  return hits;
}

export async function searchGiphy(query: string): Promise<GiphyHit[]> {
  const q = query.trim().slice(0, 80);
  const payload = (await giphyGet(
    q ? "gifs/search" : "gifs/trending",
    q
      ? { q, limit: "18", lang: "en" }
      : { limit: "18" },
  )) as { data?: GiphyItem[] };
  return mapHits(payload.data);
}

export async function resolveGiphy(id: string): Promise<{ url: string; size: number }> {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(id)) {
    throw new Error("That GIF is gone.");
  }
  const payload = (await giphyGet(`gifs/${id}`, {})) as { data?: GiphyItem };
  const item = payload.data;
  if (!item || (item.rating && item.rating !== "g")) {
    throw new Error("That GIF is not classroom-appropriate.");
  }
  const post = pickPostImage(item);
  if (!post) throw new Error("Could not load that GIF.");
  return post;
}
