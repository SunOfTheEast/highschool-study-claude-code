import type { StudyEvent } from '../shared/contracts';

export class EventHub {
  private readonly listeners = new Set<(event: StudyEvent) => void>();

  publish(event: StudyEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: (event: StudyEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
