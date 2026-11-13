import { preprocessNovel, type PreprocessOutcome } from './preprocess';

let requestId = 0;

export async function runPreprocess(file: File): Promise<PreprocessOutcome> {
  const data = await file.arrayBuffer();
  if (typeof Worker === 'undefined') return preprocessNovel(data);

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    const id = ++requestId;
    worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: PreprocessOutcome; error?: string }>) => {
      if (event.data.id !== id) return;
      worker.terminate();
      if (event.data.ok && event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? '解析失败'));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('解析失败，请重试'));
    };
    worker.postMessage({ id, data }, [data]);
  });
}
