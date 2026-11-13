import { describe, expect, it } from 'vitest';
import { splitChapters } from './chapters';

describe('splitChapters', () => {
  it('按中文章节标题切分', () => {
    const text = '第一章 初见\n张三遇见李四。\n第二章 重逢\n两人再次相见。';
    const chapters = splitChapters(text);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toContain('第一章');
    expect(chapters[0].content).toContain('张三遇见李四');
  });

  it('识别阿拉伯数字章节与 Chapter 标题', () => {
    const text = '第1章 开始\n内容一\nChapter 2 Return\n内容二';
    expect(splitChapters(text).map((chapter) => chapter.title)).toEqual([
      '第1章 开始',
      'Chapter 2 Return',
    ]);
  });

  it('无章节标题时视为全文', () => {
    const chapters = splitChapters('只有一段文字。');
    expect(chapters).toEqual([{ title: '全文', content: '只有一段文字。' }]);
  });
});
