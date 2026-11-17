import type { CandidateConfidence } from './types';

export interface MergeableCandidate {
  key: string;
  originalName: string;
  name: string;
  count: number;
  confidence: CandidateConfidence;
  selected: boolean;
  aliases?: string[];
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
