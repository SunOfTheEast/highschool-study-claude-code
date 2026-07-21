import type { StudyViewEvent } from '../shared/contracts';

export class EventHub {
  private readonly listeners = new Set<(event: StudyViewEvent) => void>();

  publish(event: StudyViewEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: (event: StudyViewEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
