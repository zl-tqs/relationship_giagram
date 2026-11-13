import { preprocessNovel } from './preprocess';

interface WorkerRequest {
  id: number;
  data: ArrayBuffer;
}

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

ctx.onmessage = (event) => {
  const { id, data } = event.data;
  try {
    ctx.postMessage({ id, ok: true, result: preprocessNovel(data) });
  } catch (error) {
    ctx.postMessage({ id, ok: false, error: error instanceof Error ? error.message : '解析失败' });
  }
};
