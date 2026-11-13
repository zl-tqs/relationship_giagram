export interface NovelChapter {
  title: string;
  content: string;
}

const HEADING = /^\s*(第[0-9零一二三四五六七八九十百千万两〇]+[章回节卷].*|Chapter\s+\d+.*|序章.*|楔子.*|尾声.*)\s*$/i;

export function splitChapters(text: string): NovelChapter[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const chapters: NovelChapter[] = [];
  let title = '';
  let content: string[] = [];

  const flush = () => {
    const joined = content.join('\n').trim();
    if (title) chapters.push({ title, content: joined });
    content = [];
  };

  for (const line of lines) {
    if (HEADING.test(line)) {
      flush();
      title = line.trim();
    } else {
      content.push(line);
    }
  }
  flush();

  const meaningful = chapters.filter((chapter) => chapter.content);
  if (meaningful.length > 0) return meaningful;
  return [{ title: '全文', content: text.trim() }];
}
