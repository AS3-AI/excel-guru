/** Escapes PostgreSQL LIKE/ILIKE wildcards (\, %, _) for a prefix search; returns "" when no non-wildcard characters remain. */
export function escapeIlikePrefix(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.replace(/[\\%_]/g, "")) return "";
  return trimmed.toLowerCase().replace(/[\\%_]/g, "\\$&");
}
