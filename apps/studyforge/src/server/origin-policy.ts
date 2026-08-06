export type BrowserOriginPolicy = {
  readonly allowedOrigins: ReadonlySet<string>;
  readonly allowMissingOrigin: boolean;
};

function localHttpOrigin(value: string): string {
  const url = new URL(value);
  const local = url.protocol === 'http:'
    && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
    && url.username === ''
    && url.password === ''
    && url.pathname === '/'
    && url.search === ''
    && url.hash === '';
  if (!local) throw new Error(`STUDYFORGE_DEV_ORIGIN_INVALID: ${value}`);
  return url.origin;
}

export function createLoopbackOriginPolicy(
  port: number,
  developmentOrigin?: string,
): BrowserOriginPolicy {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`STUDYFORGE_PORT_INVALID: ${port}`);
  }
  const allowedOrigins = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ]);
  if (developmentOrigin) allowedOrigins.add(localHttpOrigin(developmentOrigin));
  return { allowedOrigins, allowMissingOrigin: true };
}

export function isBrowserOriginAllowed(
  request: Request,
  policy: BrowserOriginPolicy,
): boolean {
  const origin = request.headers.get('origin');
  return origin === null
    ? policy.allowMissingOrigin
    : policy.allowedOrigins.has(origin);
}
