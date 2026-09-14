import { proxiedMediaUrl } from "@/lib/giphy-url";
import type { PostMedia } from "@/lib/types";

export function PostImage({
  url,
  media,
}: {
  url?: string | null;
  media?: PostMedia[] | null;
}) {
  const urls =
    media && media.length > 0
      ? media.map((item) => item.url)
      : url
        ? [url]
        : [];
  if (urls.length === 0) return null;
  return (
    <div
      className={`mt-3 grid gap-2 ${
        urls.length > 1 ? "grid-cols-2" : "grid-cols-1"
      }`}
    >
      {urls.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={proxiedMediaUrl(src)}
          alt=""
          referrerPolicy="no-referrer"
          className="max-h-80 w-full rounded-2xl bg-white/5 object-cover"
        />
      ))}
    </div>
  );
}
