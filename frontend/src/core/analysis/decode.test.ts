import { describe, expect, it } from 'vitest';
import { decodeNovelFile } from './decode';

function buffer(bytes: number[]) {
  return new Uint8Array(bytes).buffer;
}

describe('decodeNovelFile', () => {
  it('识别 UTF-8 文本', () => {
    const data = new TextEncoder().encode('张三和李四').buffer;
    const result = decodeNovelFile(data);
    expect(result.text).toBe('张三和李四');
    expect(result.encoding).toBe('utf-8');
  });

  it('去除 UTF-8 BOM', () => {
    const data = buffer([0xef, 0xbb, 0xbf, 0x41, 0x42]);
    expect(decodeNovelFile(data).text).toBe('AB');
  });

  it('识别无 BOM 的 GBK 文本', () => {
    const data = buffer([0xc4, 0xe3, 0xba, 0xc3]);
    const result = decodeNovelFile(data);
    expect(result.text).toBe('你好');
    expect(result.encoding).toBe('gbk');
  });

  it('识别 UTF-16LE BOM', () => {
    const data = buffer([0xff, 0xfe, 0x60, 0x4f]);
    expect(decodeNovelFile(data).text).toBe('你');
  });
});
