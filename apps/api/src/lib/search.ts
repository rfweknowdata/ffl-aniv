/**
 * Case- and accent-insensitive normalization for search matching. SQLite's default LIKE
 * (what Prisma's `contains` compiles to) is only case-insensitive for ASCII — it does not
 * fold "Ç"/"ç" or "Ã"/"ã", which matters a lot for a dataset entirely made of Portuguese
 * names. With ~140 members, filtering in JS after fetching everything is simpler and more
 * correct than fighting SQLite collations.
 */
const DIACRITIC_MARKS = /\p{Diacritic}/gu;

export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(DIACRITIC_MARKS, '').toLowerCase();
}

export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalizeForSearch(query);
  return fields.some((f) => f && normalizeForSearch(f).includes(q));
}
