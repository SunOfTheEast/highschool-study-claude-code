export const desktopThinkingLevels = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export type DesktopThinkingLevel = typeof desktopThinkingLevels[number];

export type DesktopModelSelection = {
  provider: string;
  model: string;
  thinking: DesktopThinkingLevel;
};

export type DesktopVisionSelection =
  | { mode: 'auto' }
  | { mode: 'model'; selection: DesktopModelSelection };

export type StudyForgeAppConfig = {
  version: 1;
  onboardingComplete: boolean;
  currentLearningSet: string | null;
  recentLearningSets: string[];
  teacher: DesktopModelSelection | null;
  scout: DesktopModelSelection | null;
  vision: DesktopVisionSelection;
};

export type StudyForgePaths = {
  appHome: string;
  appConfigPath: string;
  agentDir: string;
  authPath: string;
  modelsPath: string;
  settingsPath: string;
  sessionsDir: string;
  logsDir: string;
  actorsDir: string;
  voiceDir: string;
  documentsHome: string;
};
