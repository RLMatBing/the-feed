import type { Classification } from "./types";

const SIGNALS: { tag: Classification; words: string[] }[] = [
  {
    tag: "anti_platform",
    words: [
      "algorithm",
      "rigged",
      "this app",
      "the feed",
      "thefeed",
      "delete the",
      "boycott",
      "operator",
      "the platform",
      "this platform",
      "they're watching",
      "they are watching",
      "stop playing",
      "this is fake",
    ],
  },
  {
    tag: "funny",
    words: [
      "lol",
      "lmao",
      "lmfao",
      "haha",
      "hehe",
      "joke",
      "joking",
      "funny",
      "lmk if",
      "meme",
      "kidding",
      "💀",
      "😂",
      "😭",
    ],
  },
  {
    tag: "emotional",
    words: [
      "i feel",
      "i felt",
      "love",
      "hate",
      "miss you",
      "scared",
      "afraid",
      "lonely",
      "crying",
      "anxious",
      "depress",
      "heartbroken",
      "i'm tired",
      "im tired",
      "hurt",
    ],
  },
  {
    tag: "controversial",
    words: [
      "worst",
      "overrated",
      "underrated",
      "trash",
      "stupid",
      "cancel",
      "actually wrong",
      "fight me",
      "hot take",
      "unpopular",
      "nobody should",
      "mid as",
      "ratio",
    ],
  },
  {
    tag: "personal",
    words: [
      "honestly",
      "confession",
      "never told",
      "my mom",
      "my dad",
      "my roommate",
      "last night",
      "i used to",
      "when i was",
      "in my life",
      "about me",
    ],
  },
  {
    tag: "informational",
    words: [
      "according to",
      "studies",
      "the fact",
      "fyi",
      "reminder",
      "because",
      "in other words",
      "for example",
      "the reason",
    ],
  },
];

export function classifyBody(body: string): Classification[] {
  const text = body.toLowerCase();
  const scored = SIGNALS.map(({ tag, words }) => ({
    tag,
    hits: words.filter((word) => text.includes(word)).length,
  })).filter((row) => row.hits > 0);

  if (scored.length === 0) {
    if (/\bi['’]?(m|am|ve)\b/.test(text) && text.length > 40) {
      return ["personal"];
    }
    return ["neutral"];
  }

  scored.sort((a, b) => b.hits - a.hits);
  const tags = scored.slice(0, 2).map((row) => row.tag);
  return tags.length > 0 ? tags : ["neutral"];
}
