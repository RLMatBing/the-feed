export function PostImage({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="mt-3 max-h-80 w-full rounded-2xl object-cover"
    />
  );
}
