import type { Cooccurrence } from './types';

export function remapCooccurrences(
  pairs: Cooccurrence[],
  replacements: Record<string, string>,
): Cooccurrence[] {
  const merged = new Map<string, Cooccurrence>();
  for (const pair of pairs) {
    const a = replacements[pair.a] ?? pair.a;
    const b = replacements[pair.b] ?? pair.b;
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join('\u0000');
    const existing = merged.get(key);
    if (existing) existing.count += pair.count;
    else merged.set(key, { a, b, count: pair.count });
  }
  return [...merged.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 40);
}
