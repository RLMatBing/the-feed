import Link from "next/link";

export function InstructorLink() {
  return (
    <Link
      href="/console"
      className="text-[11px] tracking-wide text-feed-muted/55 hover:text-feed-muted"
    >
      Instructor console
    </Link>
  );
}
