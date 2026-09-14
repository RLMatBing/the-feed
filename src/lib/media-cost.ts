export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_ATTACHMENTS = 6;
export const TEXT_ENERGY = 1;
export const PHOTO_ENERGY = 2;
export const GIF_ENERGY = 3;

export type MediaKind = "photo" | "gif";

export type UploadMeta = {
  size: number;
  type: string;
  name?: string;
};

export function isGifUpload(meta: {
  type?: string;
  name?: string;
}): boolean {
  const type = (meta.type ?? "").toLowerCase();
  const name = (meta.name ?? "").toLowerCase();
  return type === "image/gif" || name.endsWith(".gif");
}

export function kindFromFile(file: { type: string; name: string }): MediaKind {
  return isGifUpload(file) ? "gif" : "photo";
}

export function postEnergyCost(input: {
  hasText: boolean;
  photos: number;
  gifs: number;
  isReply?: boolean;
}): number {
  const text = input.hasText && !input.isReply ? TEXT_ENERGY : 0;
  return text + input.photos * PHOTO_ENERGY + input.gifs * GIF_ENERGY;
}

export function energyBreakdown(input: {
  hasText: boolean;
  photos: number;
  gifs: number;
  isReply?: boolean;
}): string {
  const parts: string[] = [];
  if (input.hasText) {
    parts.push(input.isReply ? "text free" : `text ${TEXT_ENERGY}`);
  }
  if (input.photos > 0) {
    parts.push(
      `${input.photos} photo${input.photos === 1 ? "" : "s"} ${input.photos * PHOTO_ENERGY}`,
    );
  }
  if (input.gifs > 0) {
    parts.push(
      `${input.gifs} GIF${input.gifs === 1 ? "" : "s"} ${input.gifs * GIF_ENERGY}`,
    );
  }
  return parts.join(" + ");
}
