import type { CustomEntry, SessionManager } from '@earendil-works/pi-coding-agent';
import type { WorkflowSnapshot } from './contracts';

const MODE = 'studyforge.deep-mode.v1';
const WORKFLOW = 'studyforge.workflow.v1';

export class WorkflowStore {
  constructor(private readonly manager: SessionManager) {}

  setDeepMode(enabled: boolean): void {
    this.manager.appendCustomEntry(MODE, { enabled });
  }

  deepMode(): boolean {
    const entries = this.manager.getEntries().filter(
      (entry): entry is CustomEntry<{ enabled: boolean }> => (
        entry.type === 'custom' && entry.customType === MODE
      ),
    );
    return entries.at(-1)?.data?.enabled ?? false;
  }

  save(snapshot: WorkflowSnapshot): void {
    this.manager.appendCustomEntry(WORKFLOW, snapshot);
  }

  list(): WorkflowSnapshot[] {
    const latest = new Map<string, WorkflowSnapshot>();
    for (const entry of this.manager.getEntries()) {
      if (entry.type !== 'custom' || entry.customType !== WORKFLOW || !entry.data) continue;
      const snapshot = entry.data as WorkflowSnapshot;
      latest.set(snapshot.id, snapshot);
    }
    return [...latest.values()].sort((left, right) => (
      left.createdAt.localeCompare(right.createdAt)
    ));
  }
}
