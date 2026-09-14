import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { uid } from "./ids";
import { supabaseClient, usesRemoteStore } from "./persist";

const MAX_BYTES = 2 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function storePostImage(file: File): Promise<string> {
  if (file.size <= 0) {
    throw new Error("That image is empty.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Images must be under 2 MB.");
  }
  const ext = EXTENSIONS[file.type];
  if (!ext) {
    throw new Error("Use a JPEG, PNG, GIF, or WebP image.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${uid()}.${ext}`;

  if (usesRemoteStore()) {
    const sb = supabaseClient();
    if (!sb) throw new Error("Image storage is not configured.");
    const { error } = await sb.storage.from("feed-images").upload(name, bytes, {
      contentType: file.type === "image/jpg" ? "image/jpeg" : file.type,
      upsert: false,
    });
    if (error) {
      throw new Error("Could not upload that image.");
    }
    const { data } = sb.storage.from("feed-images").getPublicUrl(name);
    return data.publicUrl;
  }

  const dir = path.join(process.cwd(), ".data", "images");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `/api/media/${name}`;
}
