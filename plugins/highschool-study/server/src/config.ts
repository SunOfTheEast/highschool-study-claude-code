export type StudyConfig = { learningSetRoot: string };

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): StudyConfig {
  const learningSetRoot = env.STUDY_LEARNING_SET?.trim();
  if (!learningSetRoot) throw new Error('STUDY_LEARNING_SET is required');
  return { learningSetRoot };
}
