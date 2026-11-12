export const FIXED_GENDERS = ['男', '女'] as const;
export const DEFAULT_GENDER = '未知';
export const PRESET_GENDERS = [...FIXED_GENDERS, DEFAULT_GENDER] as const;
export const MAX_CUSTOM_GENDERS = 7;
export const MAX_GENDER_LENGTH = 20;

const PRESET_SET = new Set<string>(PRESET_GENDERS);
const customGendersKey = (userId: string) => `rmap.customGenders.${userId}`;

export function normalizeCustomGenders(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (
      !normalized
      || normalized.length > MAX_GENDER_LENGTH
      || PRESET_SET.has(normalized)
      || seen.has(normalized)
    ) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= MAX_CUSTOM_GENDERS) break;
  }
  return result;
}

export function loadCustomGenders(userId: string): string[] {
  try {
    const raw = localStorage.getItem(customGendersKey(userId));
    return raw ? normalizeCustomGenders(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeCustomGenders(userId: string, genders: string[]) {
  const normalized = normalizeCustomGenders(genders);
  try {
    if (normalized.length === 0) localStorage.removeItem(customGendersKey(userId));
    else localStorage.setItem(customGendersKey(userId), JSON.stringify(normalized));
  } catch {
    // 本地存储不可用时不影响当前编辑
  }
  return normalized;
}

export type AddCustomGenderStatus = 'saved' | 'empty' | 'invalid' | 'preset' | 'duplicate' | 'limit';

export function addCustomGender(userId: string, value: string): {
  status: AddCustomGenderStatus;
  genders: string[];
} {
  const normalized = value.trim();
  const current = loadCustomGenders(userId);
  if (!normalized) return { status: 'empty', genders: current };
  if (normalized.length > MAX_GENDER_LENGTH) return { status: 'invalid', genders: current };
  if (PRESET_SET.has(normalized)) return { status: 'preset', genders: current };
  if (current.includes(normalized)) return { status: 'duplicate', genders: current };
  if (current.length >= MAX_CUSTOM_GENDERS) return { status: 'limit', genders: current };
  return { status: 'saved', genders: writeCustomGenders(userId, [...current, normalized]) };
}

export function removeCustomGender(userId: string, value: string) {
  return writeCustomGenders(
    userId,
    loadCustomGenders(userId).filter((gender) => gender !== value),
  );
}

export function buildGenderOptions(customGenders: string[]) {
  return [...FIXED_GENDERS, ...normalizeCustomGenders(customGenders), DEFAULT_GENDER]
    .map((value) => ({ value, label: value }));
}
