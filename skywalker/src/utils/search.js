/** Case-insensitive "every word appears somewhere in these fields". */
export function matchesQuery(query, ...fields) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.flat().filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => haystack.includes(w));
}
