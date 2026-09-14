import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "feed_admin";
const PARTICIPANT_COOKIE = "feed_pid";
const SESSION_COOKIE = "feed_sid";

function secret(): string {
  return (
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "the-feed-classroom-secret"
  );
}

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "seminar";
}

function sign(value: string): string {
  const sig = createHmac("sha256", secret()).update(value).digest("hex");
  return `${value}.${sig}`;
}

function verify(token: string, expected: string): boolean {
  const signed = sign(expected);
  const a = Buffer.from(token);
  const b = Buffer.from(signed);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function setAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sign("ok"), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  return Boolean(token && verify(token, "ok"));
}

export async function setParticipantCookies(
  sessionId: string,
  token: string,
): Promise<void> {
  const jar = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12,
  };
  jar.set(SESSION_COOKIE, sessionId, opts);
  jar.set(PARTICIPANT_COOKIE, token, opts);
}

export async function readParticipantCookies(): Promise<{
  sessionId: string | null;
  token: string | null;
}> {
  const jar = await cookies();
  return {
    sessionId: jar.get(SESSION_COOKIE)?.value ?? null,
    token: jar.get(PARTICIPANT_COOKIE)?.value ?? null,
  };
}

export function passwordsMatch(input: string): boolean {
  const expected = adminPassword();
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return input === expected;
  }
  return timingSafeEqual(a, b);
}
