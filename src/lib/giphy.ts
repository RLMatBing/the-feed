import "server-only";

type GiphyImage = {
  url?: string;
  webp?: string;
  size?: string | number;
};

type GiphyItem = {
  id?: string;
  title?: string;
  rating?: string;
  images?: Record<string, GiphyImage | undefined>;
};

export type GiphyHit = {
  id: string;
  title: string;
  preview: string;
};

function apiKey(): string {
  const key = process.env.GIPHY_API_KEY?.trim();
  if (!key) throw new Error("Giphy is not configured.");
  return key;
}

export function giphyConfigured(): boolean {
  return Boolean(process.env.GIPHY_API_KEY?.trim());
}

function firstUrl(image: GiphyImage | undefined): string | null {
  const url = image?.url || image?.webp;
  return url && url.startsWith("https://") ? url : null;
}

function pickPreview(item: GiphyItem): string | null {
  const images = item.images ?? {};
  return (
    firstUrl(images.fixed_height_small) ||
    firstUrl(images.fixed_width_small) ||
    firstUrl(images.fixed_height) ||
    firstUrl(images.preview_gif) ||
    firstUrl(images.downsized) ||
    firstUrl(images.original) ||
    null
  );
}

function pickPostImage(item: GiphyItem): string | null {
  const images = item.images ?? {};
  return (
    firstUrl(images.downsized) ||
    firstUrl(images.fixed_height) ||
    firstUrl(images.original) ||
    pickPreview(item)
  );
}

async function giphyGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`https://api.giphy.com/v1/${path}`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("rating", "g");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Giphy search is unavailable.");
  }
  return response.json();
}

function mapHits(items: GiphyItem[] | undefined): GiphyHit[] {
  const hits: GiphyHit[] = [];
  for (const item of items ?? []) {
    if (!item.id) continue;
    const rating = (item.rating ?? "g").toLowerCase();
    if (rating !== "g" && rating !== "y") continue;
    const preview = pickPreview(item);
    if (!preview) continue;
    hits.push({
      id: item.id,
      title: item.title || "GIF",
      preview,
    });
  }
  return hits;
}

export async function searchGiphy(query: string): Promise<GiphyHit[]> {
  const q = query.trim().slice(0, 80);
  const payload = (await giphyGet(
    q ? "gifs/search" : "gifs/trending",
    q ? { q, limit: "24", lang: "en" } : { limit: "24" },
  )) as { data?: GiphyItem[] };
  return mapHits(payload.data);
}

export async function resolveGiphy(id: string): Promise<string> {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(id)) {
    throw new Error("That GIF is gone.");
  }
  const payload = (await giphyGet(`gifs/${id}`, {})) as { data?: GiphyItem };
  const item = payload.data;
  const rating = (item?.rating ?? "g").toLowerCase();
  if (!item || (rating !== "g" && rating !== "y")) {
    throw new Error("That GIF is not classroom-appropriate.");
  }
  const url = pickPostImage(item);
  if (!url) throw new Error("Could not load that GIF.");
  return url;
}
