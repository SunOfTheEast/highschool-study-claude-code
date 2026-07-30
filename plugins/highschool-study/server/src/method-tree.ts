import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { resolveInsideRoot } from './learning-set';
import { listCanonicalMethodNames } from './method-vocabulary';

export type MethodTreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
};

export type MethodTree = {
  rootId: string;
  nodes: MethodTreeNode[];
};

function invalid(): never {
  throw new Error('METHOD_TREE_INVALID');
}

const methodIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function exactKeys(
  value: Record<string, unknown>,
  allowed: string[],
): boolean {
  return Object.keys(value).sort().join('\0') === [...allowed].sort().join('\0');
}

export function readMethodTree(root: string): MethodTree {
  const path = resolveInsideRoot(root, join('graph', 'method_tree.yaml'));
  if (!existsSync(path)) invalid();
  const parsed = parse(readFileSync(path, 'utf8')) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    invalid();
  }
  const raw = parsed as Record<string, unknown>;
  if (
    !exactKeys(raw, ['schema', 'nodes'])
    || raw.schema !== 'studyforge.method_tree.v1'
    || !Array.isArray(raw.nodes)
  ) {
    invalid();
  }

  const nodes = raw.nodes.map((value, order) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      invalid();
    }
    const node = value as Record<string, unknown>;
    if (typeof node.id !== 'string') invalid();
    const parentId = node.parent_id === null
      ? null
      : typeof node.parent_id === 'string'
        ? node.parent_id.trim()
        : invalid();
    const name = parentId === null
      ? exactKeys(node, ['id', 'root_label', 'parent_id'])
        && typeof node.root_label === 'string'
        ? node.root_label.trim()
        : invalid()
      : exactKeys(node, ['id', 'method', 'parent_id'])
        && typeof node.method === 'string'
        ? node.method.trim()
        : invalid();
    return {
      id: node.id.trim(),
      name,
      parentId,
      order,
    };
  });

  const ids = new Set(nodes.map((node) => node.id));
  const names = new Set(nodes.map((node) => node.name));
  const roots = nodes.filter((node) => node.parentId === null);
  if (
    nodes.some((node) => !methodIdPattern.test(node.id) || !node.name)
    || ids.size !== nodes.length
    || names.size !== nodes.length
    || roots.length !== 1
  ) {
    invalid();
  }

  const rootId = roots[0]!.id;
  const canonical = new Set(listCanonicalMethodNames(root));
  const methodNames = new Set(
    nodes.filter((node) => node.id !== rootId).map((node) => node.name),
  );
  if (
    methodNames.size !== canonical.size
    || [...methodNames].some((name) => !canonical.has(name))
  ) {
    invalid();
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    if (node.parentId !== null && !ids.has(node.parentId)) invalid();
    const visited = new Set<string>();
    let current: MethodTreeNode | undefined = node;
    while (current?.parentId !== null) {
      if (visited.has(current.id)) invalid();
      visited.add(current.id);
      current = byId.get(current.parentId);
      if (!current) invalid();
    }
  }

  return { rootId, nodes };
}
