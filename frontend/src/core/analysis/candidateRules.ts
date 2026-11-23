const PHRASE_PREFIX_CHARS = new Set('着著手拉推瞅赦纨命里上'.split(''));
const PHRASE_END_CHARS = new Set(['着', '著']);

export function isPhraseCandidate(name: string): boolean {
  if (name.includes('·')) return false;
  // 著/着 也常出现在动作短语中间（如“来拉著宝玉”），不只出现在末尾。
  if ([...name].some((char) => PHRASE_END_CHARS.has(char))) return true;
  return name.length > 2 && PHRASE_PREFIX_CHARS.has(name[0]);
}
