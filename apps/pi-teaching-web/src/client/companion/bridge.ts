import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  CompanionBridge,
  CompanionControl,
  CompanionPlayback,
  CompanionPresentation,
  CompanionSnapshot,
} from './contracts';

const presentationEvent = 'studyforge:companion-presentation';
const playbackEvent = 'studyforge:companion-playback';
const controlEvent = 'studyforge:companion-control';

function onEvent<T>(event: string, listener: (value: T) => void): Promise<() => void> {
  return listen<T>(event, ({ payload }) => listener(payload));
}

export const tauriCompanionBridge: CompanionBridge = {
  snapshot: () => invoke<CompanionSnapshot>('companion_snapshot'),
  present: (presentation) => invoke<boolean>('companion_present', { presentation }),
  control: (control) => invoke<boolean>('companion_control', { control }),
  setPlayback: (playback) => invoke<void>('companion_set_playback', { playback }),
  onPresentation: (listener) => onEvent<CompanionPresentation | null>(presentationEvent, listener),
  onPlayback: (listener) => onEvent<CompanionPlayback>(playbackEvent, listener),
  onControl: (listener) => onEvent<CompanionControl>(controlEvent, listener),
  showMain: () => invoke<void>('show_main_window'),
  showCompanion: () => invoke<void>('show_companion_window'),
  hideCompanion: () => invoke<void>('hide_companion_window'),
  quit: () => invoke<void>('quit_studyforge'),
};
