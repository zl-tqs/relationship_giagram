export type NovelEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'gbk';

export interface DecodedNovel {
  text: string;
  encoding: NovelEncoding;
}

function hasBom(bytes: Uint8Array, bom: number[]) {
  return bom.every((value, index) => bytes[index] === value);
}

function decodeStrict(bytes: Uint8Array, encoding: string) {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function decodeNovelFile(data: ArrayBuffer): DecodedNovel {
  const bytes = new Uint8Array(data);

  if (hasBom(bytes, [0xef, 0xbb, 0xbf])) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  }
  if (hasBom(bytes, [0xff, 0xfe])) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
  }
  if (hasBom(bytes, [0xfe, 0xff])) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
  }

  const utf8 = decodeStrict(bytes, 'utf-8');
  if (utf8 !== null) return { text: utf8, encoding: 'utf-8' };

  const gbk = decodeStrict(bytes, 'gbk');
  if (gbk !== null) return { text: gbk, encoding: 'gbk' };

  return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
}
