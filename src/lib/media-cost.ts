export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export type UploadMeta = {
  size: number;
  type: string;
  name?: string;
};

export function isGifUpload(meta: UploadMeta): boolean {
  const type = meta.type.toLowerCase();
  const name = (meta.name ?? "").toLowerCase();
  return type === "image/gif" || name.endsWith(".gif");
}

export function mediaEnergyCost(meta: UploadMeta | null | undefined): number {
  if (!meta || meta.size <= 0) return 0;
  const gif = isGifUpload(meta);
  const unitBytes = gif ? 200_000 : 400_000;
  const chunks = Math.max(1, Math.ceil(meta.size / unitBytes));
  const extra = gif ? 3 + chunks : 1 + chunks;
  return Math.min(9, extra);
}

export function composeEnergyCost(
  basePost: number,
  baseReply: number,
  isReply: boolean,
  meta: UploadMeta | null | undefined,
): number {
  return (isReply ? baseReply : basePost) + mediaEnergyCost(meta);
}
