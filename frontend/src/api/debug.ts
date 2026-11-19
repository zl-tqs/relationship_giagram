import type { LocalAnalysisSnapshot } from '../core/analysis/debugSnapshot';

export async function saveLocalAnalysisDebug(snapshot: LocalAnalysisSnapshot) {
  if (!import.meta.env.DEV) return;
  const response = await fetch('/__debug/local-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) throw new Error('本地分析调试结果保存失败');
}
