import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACTOR_ID = 'peer-axia';
const EXPRESSIONS = new Set(['neutral', 'curious', 'skeptical']);
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8000/v1/audio/speech';
const DEFAULT_MODEL = 'mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit';

export type PeerMediaService = {
  portrait(actorId: string, expression: string): Response;
  speech(actorId: string, text: string, signal?: AbortSignal): Promise<Response>;
};

export type PeerMediaOptions = {
  actorsDir: string;
  speechEndpoint?: string;
  model?: string;
  voice?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

function unavailable(): Response {
  return Response.json({ error: 'PEER_SPEECH_UNAVAILABLE' }, { status: 503 });
}

function endpoint(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('PEER_SPEECH_ENDPOINT_INVALID');
  }
  if (
    parsed.protocol !== 'http:'
    || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname)
    || parsed.username
    || parsed.password
  ) throw new Error('PEER_SPEECH_ENDPOINT_INVALID');
  return parsed.toString();
}

export function createPeerMediaService(options: PeerMediaOptions): PeerMediaService {
  const speechEndpoint = endpoint(
    options.speechEndpoint ?? process.env.STUDYFORGE_MLX_AUDIO_URL ?? DEFAULT_ENDPOINT,
  );
  const request = options.fetch ?? fetch;
  const model = options.model ?? DEFAULT_MODEL;
  const voice = options.voice ?? process.env.STUDYFORGE_QWEN_VOICE ?? 'vivian';

  return {
    portrait(actorId, expression) {
      if (actorId !== ACTOR_ID || !EXPRESSIONS.has(expression)) {
        return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
      }
      const path = join(options.actorsDir, ACTOR_ID, `${expression}.png`);
      if (!existsSync(path)) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
      return new Response(new Uint8Array(readFileSync(path)), {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'no-store',
        },
      });
    },

    async speech(actorId, text, signal) {
      if (actorId !== ACTOR_ID || !text.trim() || text.length > 12_000 || text.includes('\0')) {
        return Response.json({ error: 'DESKTOP_REQUEST_INVALID' }, { status: 400 });
      }
      try {
        const response = await request(speechEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model,
            input: text,
            voice,
            response_format: 'wav',
          }),
          ...(signal ? { signal } : {}),
        });
        const contentType = response.headers.get('content-type') ?? '';
        if (!response.ok || !contentType.toLowerCase().startsWith('audio/')) return unavailable();
        return new Response(await response.arrayBuffer(), {
          headers: {
            'content-type': contentType,
            'cache-control': 'no-store',
          },
        });
      } catch {
        return unavailable();
      }
    },
  };
}
