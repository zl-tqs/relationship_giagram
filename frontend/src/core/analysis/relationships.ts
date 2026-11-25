import { RELATION_WORDS } from './lexicon';
import type { RelationshipMention } from './types';

interface MentionStats {
  count: number;
  targets: Map<string, number>;
  context: string;
}

const RELATION_TERMS = [...RELATION_WORDS].sort((left, right) => right.length - left.length);

function directTarget(before: string, after: string, knownNames: string[]) {
  const afterIdentity = after.replace(/^(?:是|就是|乃|为)\s*/, '');
  const beforeIdentity = before.replace(/\s*(?:是|就是|乃|为)$/, '');
  return knownNames.find((name) => after.startsWith(name))
    ?? knownNames.find((name) => afterIdentity.startsWith(name))
    ?? knownNames.find((name) => before.endsWith(name))
    ?? knownNames.find((name) => beforeIdentity.endsWith(name));
}

export function extractRelationshipMentions(
  text: string,
  knownNames: string[],
): RelationshipMention[] {
  const names = [...knownNames].filter(Boolean).sort((left, right) => right.length - left.length);
  const pattern = new RegExp(RELATION_TERMS.join('|'), 'g');
  const stats = new Map<string, MentionStats>();

  for (const match of text.matchAll(pattern)) {
    const term = match[0];
    const start = match.index ?? 0;
    const before = text.slice(Math.max(0, start - 12), start);
    const after = text.slice(start + term.length, start + term.length + 12);
    const target = directTarget(before, after, names);
    const current = stats.get(term) ?? {
      count: 0,
      targets: new Map<string, number>(),
      context: '',
    };
    current.count += 1;
    if (target) current.targets.set(target, (current.targets.get(target) ?? 0) + 1);
    if (!current.context) {
      current.context = text
        .slice(Math.max(0, start - 18), Math.min(text.length, start + term.length + 18))
        .replace(/\s+/g, ' ')
        .trim();
    }
    stats.set(term, current);
  }

  return [...stats.entries()]
    .map(([term, value]) => ({
      term,
      count: value.count,
      ...(value.targets.size === 1 ? { suggestedTarget: [...value.targets.keys()][0] } : {}),
      context: value.context,
    }))
    .sort((left, right) => right.count - left.count || left.term.localeCompare(right.term, 'zh-Hans-CN'));
}
