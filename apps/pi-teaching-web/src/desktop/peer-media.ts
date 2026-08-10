import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACTOR_ID = 'peer-axia';
const EXPRESSIONS = new Set(['neutral', 'curious', 'skeptical']);
const SPEECH_ENDPOINT = 'https://api.xiaomimimo.com/v1/chat/completions';
const SPEECH_STYLE = '年轻自然的中国女声，像熟悉的同班同学在认真交流；清晰、松弛，不过度表演。';
const CLONED_SPEECH_STYLE = '保持参考音频中说话人的真实发音习惯。她的中文不是母语：保留自然、轻微的外国语音、声调偏差、重音和停顿，不要纠正成标准普通话。声音甜软、明亮而亲近，像熟悉的同龄女生轻声聊天，句尾可以轻微上扬；不要幼态，不要嗲声，不要耳语，不要播音腔，也不要夸张模仿。';

export type PeerMediaService = {
  portrait(actorId: string, expression: string): Response;
  speech(actorId: string, text: string, signal?: AbortSignal): Promise<Response>;
};

export type PeerMediaOptions = {
  actorsDir: string;
  resolveSpeechApiKey?: () => Promise<string | null | undefined>;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

function unavailable(): Response {
  return Response.json({ error: 'PEER_SPEECH_UNAVAILABLE' }, { status: 503 });
}

function audioData(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return null;
  const audio = (message as { audio?: unknown }).audio;
  if (!audio || typeof audio !== 'object') return null;
  const data = (audio as { data?: unknown }).data;
  return typeof data === 'string' && data.length > 0 ? data : null;
}

function privateVoice(actorsDir: string): { model: string; voice: string } | null {
  for (const [name, mime] of [['voice.mp3', 'audio/mpeg'], ['voice.wav', 'audio/wav']] as const) {
    const path = join(actorsDir, ACTOR_ID, name);
    if (existsSync(path)) {
      return {
        model: 'mimo-v2.5-tts-voiceclone',
        voice: `data:${mime};base64,${readFileSync(path).toString('base64')}`,
      };
    }
  }
  return null;
}

export function createPeerMediaService(options: PeerMediaOptions): PeerMediaService {
  const request = options.fetch ?? fetch;
  const resolveSpeechApiKey = options.resolveSpeechApiKey ?? (async () => (
    process.env.MIMO_API_KEY ?? process.env.XIAOMI_API_KEY
  ));

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
        const apiKey = await resolveSpeechApiKey();
        if (!apiKey) return unavailable();
        const cloned = privateVoice(options.actorsDir);
        const response = await request(SPEECH_ENDPOINT, {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: cloned?.model ?? 'mimo-v2.5-tts',
            messages: [
              { role: 'user', content: cloned ? CLONED_SPEECH_STYLE : SPEECH_STYLE },
              { role: 'assistant', content: text },
            ],
            audio: { format: 'wav', voice: cloned?.voice ?? '冰糖' },
          }),
          ...(signal ? { signal } : {}),
        });
        if (!response.ok) return unavailable();
        const data = audioData(await response.json());
        if (!data) return unavailable();
        const bytes = Buffer.from(data, 'base64');
        if (bytes.length === 0) return unavailable();
        return new Response(bytes, {
          headers: {
            'content-type': 'audio/wav',
            'cache-control': 'no-store',
          },
        });
      } catch {
        return unavailable();
      }
    },
  };
}
