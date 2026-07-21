export function createRequestHandler() {
  return (request: Request): Response => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json({ ok: true, runtime: 'pi' });
    }
    return new Response('Not found', { status: 404 });
  };
}
