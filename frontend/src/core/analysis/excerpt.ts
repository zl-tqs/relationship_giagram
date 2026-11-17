interface ExcerptOptions {
  maxChars?: number;
  replacements?: Record<string, string>;
}

function applyReplacements(text: string, replacements: Record<string, string>) {
  const canonicalNames = [...new Set(Object.values(replacements))]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  const placeholders = new Map<string, string>();
  let result = text;

  canonicalNames.forEach((name, index) => {
    const token = `\u0000${index}\u0000`;
    placeholders.set(token, name);
    result = result.split(name).join(token);
  });

  for (const [from, to] of Object.entries(replacements).sort((a, b) => b[0].length - a[0].length)) {
    if (from && to && from !== to) result = result.split(from).join(to);
  }

  for (const [token, name] of placeholders) {
    result = result.split(token).join(name);
  }
  return result;
}

export function buildExcerpt(text: string, names: string[], options: ExcerptOptions = {}): string {
  const maxChars = options.maxChars ?? 12000;
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) return '';

  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const scored = paragraphs.map((paragraph) => {
    let mentions = 0;
    for (const name of unique) {
      if (paragraph.includes(name)) mentions += 1;
    }
    return { paragraph: applyReplacements(paragraph, options.replacements ?? {}), mentions };
  });

  const selected: string[] = [];
  let length = 0;
  const append = (paragraph: string) => {
    if (length + paragraph.length > maxChars) return false;
    selected.push(paragraph);
    length += paragraph.length + 2;
    return true;
  };

  for (const item of scored.filter((entry) => entry.mentions >= 2)) {
    append(item.paragraph);
    if (length >= maxChars) break;
  }

  if (length < 800) {
    for (const item of scored.filter((entry) => entry.mentions === 1)) {
      if (!append(item.paragraph)) break;
    }
  }

  if (selected.length === 0) {
    return scored.map((item) => item.paragraph).join('\n\n').slice(0, maxChars);
  }
  return selected.join('\n\n').slice(0, maxChars);
}
