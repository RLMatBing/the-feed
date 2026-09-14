import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { emptyDatabase } from "./engine";
import type { Database } from "./types";

export function usesRemoteStore(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY),
  );
}

export function supabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asDatabase(raw: unknown): Database {
  if (!raw || typeof raw !== "object") return emptyDatabase();
  const data = raw as Database;
  if (!data.sessions || !data.participants || !data.posts) return emptyDatabase();
  return data;
}

export async function remoteLoad(): Promise<{ db: Database; version: number }> {
  const sb = supabaseClient();
  if (!sb) return { db: emptyDatabase(), version: 0 };
  const { data, error } = await sb
    .from("game_state")
    .select("data, version")
    .eq("id", "main")
    .maybeSingle();
  if (error) throw new Error(`Could not load classroom state: ${error.message}`);
  if (!data) return { db: emptyDatabase(), version: 0 };
  return { db: asDatabase(data.data), version: data.version ?? 0 };
}

export async function remoteSave(db: Database, version: number): Promise<boolean> {
  const sb = supabaseClient();
  if (!sb) return true;
  const { data, error } = await sb
    .from("game_state")
    .update({
      data: db,
      version: version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "main")
    .eq("version", version)
    .select("id");
  if (error) throw new Error(`Could not save classroom state: ${error.message}`);
  return Boolean(data && data.length > 0);
}
