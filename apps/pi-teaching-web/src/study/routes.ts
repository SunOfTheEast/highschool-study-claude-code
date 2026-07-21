import { readFileSync } from 'node:fs';
import { resolveInsideRoot } from 'highschool-study-markdown/study-domain';
import type { RouteChange } from '../shared/contracts';

const actions = new Set<RouteChange['action']>(['insert', 'skip', 'move', 'repeat']);

function field(source: string, label: string): string | null {
  return new RegExp(`^- ${label}:\\s*(.*?)\\s*$`, 'm').exec(source)?.[1] ?? null;
}

export function readRouteChanges(root: string, lessonPath: string): RouteChange[] {
  const source = readFileSync(resolveInsideRoot(root, lessonPath), 'utf8');
  const matches = [...source.matchAll(/^### Route change (route-\d+)\s*$/gm)];
  return matches.flatMap((match, index) => {
    const section = source.slice(match.index! + match[0].length, matches[index + 1]?.index);
    const action = field(section, 'Action');
    const blockId = field(section, 'Block');
    const reason = field(section, 'Reason');
    const sourceAnchor = field(section, 'Source');
    if (!action || !actions.has(action as RouteChange['action']) || !blockId || !reason || !sourceAnchor) {
      return [];
    }
    return [{
      id: match[1]!,
      action: action as RouteChange['action'],
      blockId,
      before: field(section, 'Before'),
      after: field(section, 'After'),
      reason,
      source: sourceAnchor,
    }];
  });
}

function place(route: string[], blockId: string, change: RouteChange): void {
  const before = change.before ? route.indexOf(change.before) : -1;
  if (before >= 0) {
    route.splice(before, 0, blockId);
    return;
  }
  const after = change.after ? route.indexOf(change.after) : -1;
  if (after >= 0) {
    route.splice(after + 1, 0, blockId);
    return;
  }
  route.push(blockId);
}

export function applyRouteChanges(initial: string[], changes: RouteChange[]): string[] {
  const route = [...initial];
  for (const change of changes) {
    if (change.action === 'skip') {
      const index = route.indexOf(change.blockId);
      if (index >= 0) route.splice(index, 1);
      continue;
    }
    if (change.action === 'repeat') {
      place(route, change.blockId, change);
      continue;
    }
    if (change.action === 'move') {
      const index = route.indexOf(change.blockId);
      if (index >= 0) route.splice(index, 1);
      place(route, change.blockId, change);
      continue;
    }
    if (!route.includes(change.blockId)) place(route, change.blockId, change);
  }
  return route;
}
