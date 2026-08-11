import { invoke } from '@tauri-apps/api/core';
import { tauriCompanionBridge } from '../companion/bridge';
import type { CompanionBridge } from '../companion/contracts';

export type RuntimeConnection = {
  state:
    | { status: 'starting' }
    | { status: 'ready'; port: number; workspace: 'setup' | 'selected' }
    | { status: 'stopped' }
    | { status: 'crashed'; code: number | null };
  apiBase: string | null;
  token: string | null;
  error: string | null;
};

export type DesktopBridge = {
  readonly isDesktop: boolean;
  readonly companion?: CompanionBridge | null;
  runtimeConnection(): Promise<RuntimeConnection>;
  restartRuntime(): Promise<void>;
  chooseLearningSetFolder(): Promise<string | null>;
  revealInFinder(path: string): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
};

export function isDesktopEnvironment(value: unknown = globalThis): boolean {
  if (!value || typeof value !== 'object') return false;
  return '__TAURI_INTERNALS__' in value;
}

export const tauriDesktopBridge: DesktopBridge = {
  isDesktop: typeof window !== 'undefined' && isDesktopEnvironment(window),
  companion: tauriCompanionBridge,
  runtimeConnection: () => invoke<RuntimeConnection>('runtime_connection'),
  restartRuntime: () => invoke<void>('restart_runtime'),
  chooseLearningSetFolder: () => invoke<string | null>('choose_learning_set_folder'),
  revealInFinder: (path) => invoke<void>('reveal_in_finder', { path }),
  openExternalUrl: (url) => invoke<void>('open_external_url', { url }),
};
