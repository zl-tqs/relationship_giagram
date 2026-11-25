import type { CandidateConfidence, OnlineLookupCharacter } from './types';

export interface MergeableCandidate {
  key: string;
  originalName: string;
  name: string;
  count: number;
  confidence: CandidateConfidence;
  selected: boolean;
  aliases?: string[];
}

export interface OnlineCandidateRow {
  key: string;
  name: string;
  aliases: string[];
  description?: string;
  matched: boolean;
  selected: boolean;
}

export function buildOnlineCandidateRows<T extends MergeableCandidate>(
  rows: T[],
  characters: OnlineLookupCharacter[],
): OnlineCandidateRow[] {
  return characters
    .map((character, index) => {
      const name = character.name.trim();
      return {
        key: `online-${index}-${name}`,
        name,
        aliases: (character.aliases ?? []).map((alias) => alias.trim()).filter(Boolean),
        description: character.description,
        matched: rows.some((row) => (
          row.name.trim() === name || row.aliases?.includes(name)
        )),
        selected: false,
      };
    })
    .filter((row) => row.name);
}

export function addOnlineAliases<T extends MergeableCandidate>(
  rows: T[],
  characters: OnlineLookupCharacter[],
): T[] {
  return rows.map((row) => {
    const matched = characters.find((character) => (
      character.name.trim() === row.name.trim() || row.aliases?.includes(character.name.trim())
    ));
    if (!matched) return row;
    return {
      ...row,
      aliases: [...new Set([...(row.aliases ?? []), ...(matched.aliases ?? [])])]
        .filter((alias) => alias !== row.name),
    };
  });
}

export function mergeCandidateRows<T extends MergeableCandidate>(
  rows: T[],
  sourceKey: string,
  targetKey: string,
): T[] {
  if (sourceKey === targetKey) return rows;
  const source = rows.find((row) => row.key === sourceKey);
  const target = rows.find((row) => row.key === targetKey);
  if (!source || !target) return rows;

  const aliases = new Set([
    ...(target.aliases ?? []),
    ...(source.aliases ?? []),
    source.originalName,
    source.name,
  ].filter(Boolean));
  aliases.delete(target.name);
  aliases.delete(target.originalName);

  return rows
    .filter((row) => row.key !== sourceKey)
    .map((row) => (
      row.key === targetKey
        ? {
            ...row,
            count: row.count + source.count,
            selected: row.selected || source.selected,
            aliases: [...aliases],
          }
        : row
    ));
}
