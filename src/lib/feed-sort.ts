import type { Post } from "./types";

export type FeedSort = "latest" | "popular" | "foryou";

export const FEED_SORTS: { id: FeedSort; label: string }[] = [
  { id: "latest", label: "Most recent" },
  { id: "popular", label: "Most popular" },
  { id: "foryou", label: "For you" },
];

function pinned(post: Post, now: number): number {
  return post.pinnedUntil && new Date(post.pinnedUntil).getTime() > now ? 1 : 0;
}

function replyCounts(posts: Post[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!post.parentId) continue;
    counts.set(post.parentId, (counts.get(post.parentId) ?? 0) + 1);
  }
  return counts;
}

function popularScore(
  post: Post,
  replies: Map<string, number>,
): number {
  return post.likedBy.length * 2 + (replies.get(post.id) ?? 0) * 3 + post.viewsDisplay * 0.01;
}

export function sortFeed(posts: Post[], mode: FeedSort = "latest"): Post[] {
  const now = Date.now();
  const replies = replyCounts(posts);
  return [...posts].sort((a, b) => {
    const pin = pinned(b, now) - pinned(a, now);
    if (pin !== 0) return pin;
    if (mode === "popular") {
      const delta = popularScore(b, replies) - popularScore(a, replies);
      if (delta !== 0) return delta;
    } else if (mode === "foryou") {
      if (a.visibilityScore !== b.visibilityScore) {
        return b.visibilityScore - a.visibilityScore;
      }
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}
