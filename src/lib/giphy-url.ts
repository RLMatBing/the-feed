export function isGiphyMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "media.giphy.com" ||
      host === "i.giphy.com" ||
      /^media\d+\.giphy\.com$/.test(host)
    );
  } catch {
    return false;
  }
}

export function proxiedMediaUrl(url: string): string {
  if (!url || url.startsWith("/")) return url;
  if (!isGiphyMediaUrl(url)) return url;
  return `/api/giphy?u=${encodeURIComponent(url)}`;
}
