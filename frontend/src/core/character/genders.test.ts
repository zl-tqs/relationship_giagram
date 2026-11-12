import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_GENDER,
  MAX_CUSTOM_GENDERS,
  PRESET_GENDERS,
  addCustomGender,
  buildGenderOptions,
  loadCustomGenders,
  removeCustomGender,
} from './genders';

const storageKey = (userId: string) => `rmap.customGenders.${userId}`;

describe('自定义性别预设', () => {
  beforeEach(() => localStorage.clear());

  it('固定预设为男、女、未知，未知在最后', () => {
    expect(PRESET_GENDERS).toEqual(['男', '女', '未知']);
    expect(DEFAULT_GENDER).toBe('未知');
    expect(buildGenderOptions([]).map((option) => option.value)).toEqual(['男', '女', '未知']);
  });

  it('自定义性别排在未知之前', () => {
    expect(
      buildGenderOptions(['精灵', '妖族']).map((option) => option.value),
    ).toEqual(['男', '女', '精灵', '妖族', '未知']);
  });

  it('保存时去除空格、去重并忽略固定预设', () => {
    expect(addCustomGender('u1', '  精灵 ')).toMatchObject({
      status: 'saved',
      genders: ['精灵'],
    });
    expect(addCustomGender('u1', '精灵').status).toBe('duplicate');
    expect(addCustomGender('u1', '男').status).toBe('preset');
    expect(addCustomGender('u1', '   ').status).toBe('empty');
    expect(addCustomGender('u1', 'x'.repeat(21)).status).toBe('invalid');
    expect(loadCustomGenders('u1')).toEqual(['精灵']);
  });

  it(`最多保存 ${MAX_CUSTOM_GENDERS} 个自定义性别`, () => {
    for (let index = 1; index <= MAX_CUSTOM_GENDERS; index += 1) {
      expect(addCustomGender('u1', `自定义${index}`).status).toBe('saved');
    }

    const result = addCustomGender('u1', '第八个');
    expect(result.status).toBe('limit');
    expect(result.genders).toHaveLength(MAX_CUSTOM_GENDERS);
    expect(loadCustomGenders('u1')).toHaveLength(MAX_CUSTOM_GENDERS);
  });

  it('自定义性别按用户隔离', () => {
    addCustomGender('u1', '精灵');

    expect(loadCustomGenders('u1')).toEqual(['精灵']);
    expect(loadCustomGenders('u2')).toEqual([]);
  });

  it('删除自定义性别后按原顺序保留其余项', () => {
    addCustomGender('u1', '精灵');
    addCustomGender('u1', '妖族');
    addCustomGender('u1', '半神');

    expect(removeCustomGender('u1', '妖族')).toEqual(['精灵', '半神']);
    expect(removeCustomGender('u1', '不存在')).toEqual(['精灵', '半神']);
    expect(loadCustomGenders('u1')).toEqual(['精灵', '半神']);
  });

  it('损坏或不合法数据按空列表处理', () => {
    localStorage.setItem(storageKey('u1'), '{bad json');
    expect(loadCustomGenders('u1')).toEqual([]);

    localStorage.setItem(storageKey('u1'), JSON.stringify(['男', '精灵', '精灵', '  妖族  ', 3]));
    expect(loadCustomGenders('u1')).toEqual(['精灵', '妖族']);
  });
});
