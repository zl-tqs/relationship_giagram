import type { CharacterCandidate, Cooccurrence } from './types';

const SINGLE_SURNAMES = new Set(
  '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣邓郁单杭洪包诸左石崔吉龚程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍郤璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公',
);

const COMPOUND_SURNAMES = [
  '欧阳', '司马', '上官', '诸葛', '东方', '令狐', '独孤', '慕容', '南宫', '西门',
  '夏侯', '尉迟', '皇甫', '长孙', '宇文', '司徒', '公孙', '闻人', '轩辕', '端木',
  '百里', '东郭', '南门', '呼延', '羊舌', '微生', '梁丘', '左丘', '东门',
];

const STOP_WORDS = new Set([
  '时候', '时间', '世界', '事情', '东西', '地方', '地上', '地下', '天下', '天空', '天气',
  '问题', '方法', '方面', '方式', '方向', '方案', '方便', '旁人', '旁边', '里面', '里头',
  '外面', '上头', '下面', '前面', '后面', '左手', '右手', '左臂', '右臂', '左右', '南方',
  '北方', '西方', '春天', '夏天', '秋天', '冬天', '今日', '今天', '明日', '明天', '昨日',
  '昨天', '今年', '明年', '去年', '当时', '当年', '晚上', '早上', '上午', '下午', '中午',
  '半夜', '黄金', '黄沙', '黄昏', '白天', '白日', '白云', '白发', '白衣', '高手', '高兴',
  '高速', '高大', '高山', '高台', '江南', '江湖', '林中', '林间', '石头', '石板', '王宫',
  '王国', '王朝', '李子', '毛病', '史书', '史册', '唐突', '后果', '度量', '庞大', '安静',
  '安全', '周身', '周围', '余地', '余光', '元宝', '平凡', '平常', '和平', '何必', '何况',
  '何时', '何处', '何人', '如何', '为何', '于是', '由于', '马虎', '马上', '风景', '风波',
  '风格', '花白', '花园', '花丛', '白净', '白昼', '百家', '万家', '万里', '千里', '百姓',
  '诸位', '诸多', '左右为难', '张望', '张开', '张罗', '苏醒', '胡同', '罗盘', '程度', '秋千',
]);

const INVALID_END_CHARS = new Set(
  '说道问答笑哭喊叫走跑站坐起来去回进出开关看听想知觉了着过的地得和与同跟向对把被将在是有无没就都也又还再才只已曾正刚却但而或及等让使给为以于从到至之其此这那哪要会能可上下里外前后中内旁边处时候分秒年月日个只些位名次头尾手脚身心眼口耳脸声气力命事情物人家门宫城村国众者并独便仍竟忙顿随互更最太皆均莫勿若似像',
);

function givenNameLength(name: string) {
  const surnameLength = COMPOUND_SURNAMES.some((surname) => name.startsWith(surname)) ? 2 : 1;
  return name.length - surnameLength;
}

const SPEECH_PATTERN = /说道|笑道|问道|答道|喝道|叹道|沉声道|冷声道|低声道|大声道|轻声道|开口道|回答道|喊道|叫道|说|道|问|答|笑/g;

const TITLE_PATTERN = /长老|掌门|师父|师尊|师兄|师姐|师弟|师妹|前辈|大人|公子|姑娘|小姐|将军|陛下|王爷|皇后|公主|先生/g;

const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

function isChinese(value: string) {
  return /^[\u4e00-\u9fa5]+$/.test(value);
}

function startsWithSurname(name: string) {
  if (COMPOUND_SURNAMES.some((surname) => name.startsWith(surname))) return true;
  return SINGLE_SURNAMES.has(name[0]);
}

function isCandidate(name: string) {
  if (name.length < 2 || name.length > 4) return false;
  if (!isChinese(name)) return false;
  if (STOP_WORDS.has(name)) return false;
  if (!startsWithSurname(name)) return false;
  return !INVALID_END_CHARS.has(name[name.length - 1]);
}

function countOccurrences(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.match(new RegExp(escaped, 'g'))?.length ?? 0;
}

function namesBeforeMatches(text: string, pattern: RegExp) {
  const counts = new Map<string, number>();
  pattern.lastIndex = 0;
  let match = pattern.exec(text);
  while (match) {
    const before = text.slice(Math.max(0, match.index - 4), match.index);
    for (let length = Math.min(4, before.length); length >= 2; length -= 1) {
      const name = before.slice(before.length - length);
      if (isCandidate(name)) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
        break;
      }
    }
    match = pattern.exec(text);
  }
  return counts;
}

function scanSurnames(text: string) {
  const counts = new Map<string, number>();
  for (let index = 0; index < text.length; index += 1) {
    const compound = COMPOUND_SURNAMES.find((surname) => text.startsWith(surname, index));
    const surnameLength = compound ? compound.length : SINGLE_SURNAMES.has(text[index]) ? 1 : 0;
    if (!surnameLength) continue;

    let chosen = '';
    for (let givenLength = 2; givenLength >= 1; givenLength -= 1) {
      const name = text.slice(index, index + surnameLength + givenLength);
      if (name.length === surnameLength + givenLength && isCandidate(name)) {
        chosen = name;
        break;
      }
    }
    if (!chosen) continue;
    counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
    index += chosen.length - 1;
  }
  return counts;
}

function mergeCounts(
  text: string,
  strong: Map<string, number>,
  scanned: Map<string, number>,
  threshold: number,
) {
  const names = new Set<string>([...strong.keys()]);
  for (const [name, count] of scanned) {
    if (count >= threshold) names.add(name);
  }
  const candidates: CharacterCandidate[] = [];
  for (const name of names) {
    const count = Math.max(strong.get(name) ?? 0, scanned.get(name) ?? 0, countOccurrences(text, name));
    candidates.push({
      name,
      count,
      confidence: strong.has(name) ? 'high' : count >= 3 ? 'medium' : 'low',
    });
  }
  return candidates;
}

export function extractCharacterCandidates(text: string, limit = 60): CharacterCandidate[] {
  const strong = new Map<string, number>();
  for (const source of [namesBeforeMatches(text, SPEECH_PATTERN), namesBeforeMatches(text, TITLE_PATTERN)]) {
    for (const [name, count] of source) strong.set(name, (strong.get(name) ?? 0) + count);
  }

  const scanned = scanSurnames(text);
  const threshold = text.length < 500 ? 1 : 3;
  const candidates = mergeCounts(text, strong, scanned, threshold).filter((item) => {
    if (item.confidence === 'high') return true;
    const scannedCount = scanned.get(item.name) ?? 0;
    return givenNameLength(item.name) >= 2 ? scannedCount >= 3 : scannedCount >= threshold;
  });

  return candidates
    .sort((a, b) => {
      const byConfidence = CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
      if (byConfidence !== 0) return byConfidence;
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    })
    .slice(0, limit);
}

export function buildCooccurrences(text: string, names: string[], limit = 40): Cooccurrence[] {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (unique.length < 2) return [];

  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const counts = new Map<string, number>();
  for (const paragraph of paragraphs) {
    const present: number[] = [];
    unique.forEach((name, index) => {
      if (paragraph.includes(name)) present.push(index);
    });
    for (let i = 0; i < present.length; i += 1) {
      for (let j = i + 1; j < present.length; j += 1) {
        const key = `${present[i]}:${present[j]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split(':').map(Number);
      return { a: unique[a], b: unique[b], count };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}
