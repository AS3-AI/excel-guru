export const PROFILE_HREF = "/profile";

export type NavKey = "learn" | "pricing" | "help" | "profile";

export const MARKETING_LINKS: readonly { key: NavKey; href: string; label: string }[] = [
  { key: "learn", href: "/learn", label: "Guides" },
  { key: "pricing", href: "/pricing", label: "Pricing" },
  { key: "help", href: "/help", label: "Help" },
];

export function moduleHref(slug: string): string {
  return `/modules/${slug}`;
}
