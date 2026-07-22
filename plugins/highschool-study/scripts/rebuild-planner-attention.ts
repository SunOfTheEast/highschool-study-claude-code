import { rebuildPlannerAttention } from '../server/src/planner-attention';

export { rebuildPlannerAttention } from '../server/src/planner-attention';

if (import.meta.main) {
  const root = process.env.STUDY_LEARNING_SET;
  if (!root) throw new Error('STUDY_LEARNING_SET is required');
  rebuildPlannerAttention(root);
}
