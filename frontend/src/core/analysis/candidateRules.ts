import { COMPOUND_SURNAMES, TRANSLITERATION_CHARS } from './lexicon';

// 动作短语里常出现在人名之前的动词/方位词。
// 与 lexicon.PHRASE_PREFIX_CHARS（供 dropKnownNamePhrases 使用）含义不同，故独立命名。
const ACTION_PHRASE_LEAD_CHARS = new Set('手拉推瞅赦纨命里上'.split(''));
// 出现在短语任意位置即说明是动作短语的动词体标记（如“伸出手来拉著宝玉”）。
const PHRASE_VERB_MARKERS = new Set(['着', '著']);

// 与姓名形状判定共用同一口径：至少两个音译信号字，或带间隔号的 3 字以上片段。
export function isTransliterationLike(name: string) {
  const chars = [...name].filter((char) => char !== '·');
  const signals = chars.filter((char) => TRANSLITERATION_CHARS.has(char)).length;
  return signals >= 2 || (name.includes('·') && chars.length >= 3);
}

export function isPhraseCandidate(name: string): boolean {
  if (name.includes('·')) return false;
  // 著/着 常出现在动作短语中间（如“手来拉著宝玉”），不只是末尾。
  if ([...name].some((char) => PHRASE_VERB_MARKERS.has(char))) return true;
  // 复姓开头的名字不是短语，如 上官婉儿、诸葛孔明。
  if (COMPOUND_SURNAMES.some((surname) => name.startsWith(surname))) return false;
  // 音译名首字常是动作词（如 拉尔夫），按音译信号字放行。
  if (isTransliterationLike(name)) return false;
  return name.length > 2 && ACTION_PHRASE_LEAD_CHARS.has(name[0]);
}
