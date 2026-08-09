export const desktopThinkingLevels = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const;

export type DesktopThinkingLevel = typeof desktopThinkingLevels[number];

export type DesktopModelSelection = {
  provider: string;
  model: string;
  thinking: DesktopThinkingLevel;
};

export type StudyForgeAppConfig = {
  version: 1;
  onboardingComplete: boolean;
  currentLearningSet: string | null;
  recentLearningSets: string[];
  teacher: DesktopModelSelection | null;
  scout: DesktopModelSelection | null;
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
  documentsHome: string;
};
