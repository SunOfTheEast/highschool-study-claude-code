const defaultError = '这一步暂时没有完成，请稍后再试。';
const sessionError = '老师这次没有完成回复。学习记录没有丢失，可以再试一次。';

function statusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

export function publicErrorText(error: unknown, fallback = defaultError): string {
  const status = statusCode(error);
  if (status === 401 || status === 403) return '模型服务尚未完成授权，请到设置中重新连接。';
  if (status === 404) return '这项内容暂时找不到，可能已经移动或失效。';
  if (status === 409) return '内容已经发生变化，请刷新后再试。';
  return fallback;
}

export function publicSessionErrorText(): string {
  return sessionError;
}
