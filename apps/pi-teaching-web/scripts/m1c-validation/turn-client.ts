import { existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  sendObservedTurn,
  type ObservedTurn,
} from '../m1a-validation/turn-client';

export type RecordedTurnOptions = {
  baseUrl: string;
  sessionKey: string;
  message: string;
  eventLogPath: string;
  turnPath: string;
};

function prepareNewFile(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) return;
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`turn evidence target must be a plain file: ${path}`);
  }
  throw new Error(`turn evidence target already exists: ${path}`);
}

export async function sendRecordedTurn(options: RecordedTurnOptions): Promise<ObservedTurn> {
  prepareNewFile(options.turnPath);
  const turn = await sendObservedTurn(options);
  writeFileSync(options.turnPath, `${JSON.stringify({
    message: options.message,
    ...turn,
    firstVisibleDelayMs: turn.firstVisibleAt === null ? null : turn.firstVisibleAt - turn.startedAt,
    settledDelayMs: turn.settledAt - turn.startedAt,
  }, null, 2)}\n`, { mode: 0o600 });
  return turn;
}
