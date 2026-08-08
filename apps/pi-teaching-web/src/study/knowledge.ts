import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type {
  KnowledgeCard,
  KnowledgeMaterial,
  KnowledgeMethodNode,
  KnowledgeSnapshot,
} from '../shared/contracts';
import { StudyDocumentError } from './markdown';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function filesBelow(root: string, directory: string): string[] {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  const files: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(relative(root, path).replaceAll('\\', '/'));
    }
  };
  visit(absolute);
  return files.sort();
}

function yamlFile(root: string, path: string): Record<string, unknown> {
  try {
    const parsed = parseYaml(readFileSync(join(root, path), 'utf8')) as unknown;
    const value = record(parsed);
    if (!value) throw new Error('YAML root must be a mapping');
    return value;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid YAML';
    throw new StudyDocumentError(path, reason);
  }
}

function readMethods(root: string): KnowledgeMethodNode[] {
  const path = 'graph/method_tree.yaml';
  if (!existsSync(join(root, path))) return [];
  const value = yamlFile(root, path);
  if (value.schema !== 'studyforge.method_tree.v1' || !Array.isArray(value.nodes)) {
    throw new StudyDocumentError(path, 'expected studyforge.method_tree.v1 nodes');
  }
  const methods = value.nodes.map((item): KnowledgeMethodNode => {
    const node = record(item);
    const id = node?.id;
    const parentId = node?.parent_id;
    const name = parentId === null ? node?.root_label : node?.method;
    if (
      typeof id !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)
      || (parentId !== null && typeof parentId !== 'string')
      || typeof name !== 'string'
      || name.trim().length === 0
    ) {
      throw new StudyDocumentError(path, 'invalid method node');
    }
    return { id, name: name.trim(), parentId, children: [] };
  });
  const byId = new Map(methods.map((node) => [node.id, node]));
  if (byId.size !== methods.length) throw new StudyDocumentError(path, 'duplicate method id');
  if (methods.filter((node) => node.parentId === null).length !== 1) {
    throw new StudyDocumentError(path, 'method tree must have exactly one root');
  }
  for (const node of methods) {
    if (node.parentId === null) continue;
    const parent = byId.get(node.parentId);
    if (!parent) throw new StudyDocumentError(path, `unknown method parent ${node.parentId}`);
    parent.children.push(node.id);
  }
  return methods;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readCards(root: string): KnowledgeCard[] {
  return filesBelow(root, 'cards')
    .filter((path) => ['.yaml', '.yml'].includes(extname(path).toLowerCase()))
    .flatMap((path) => {
      const value = yamlFile(root, path);
      if (value.schema !== 'highschool-study.problem-card.v1') return [];
      const id = text(value.content_item_id);
      if (!id) throw new StudyDocumentError(path, 'card is missing content_item_id');
      const graph = record(value.graph);
      const method = record(graph?.method);
      const primaryMethod = text(method?.primary);
      const supportingMethods = Array.isArray(method?.secondary)
        ? method.secondary.filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim()).filter(Boolean)
        : [];
      const stem = text(value.stem) ?? id;
      return [{
        path,
        id,
        title: stem.split(/\r?\n/, 1)[0]!,
        sourceNumber: text(value.source_number),
        primaryMethod,
        supportingMethods: [...new Set(supportingMethods)],
      }];
    });
}

function materialKind(path: string): KnowledgeMaterial['kind'] {
  const extension = extname(path).toLowerCase();
  if (['.md', '.txt', '.html', '.pdf'].includes(extension)) return 'text';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) return 'image';
  if (['.mp3', '.m4a', '.wav', '.mp4', '.mov', '.webm'].includes(extension)) return 'media';
  return 'other';
}

function readMaterials(root: string): KnowledgeMaterial[] {
  return filesBelow(root, 'materials').map((path) => {
    let title = basename(path);
    if (extname(path).toLowerCase() === '.md') {
      const match = /^#\s+(.+?)\s*$/m.exec(readFileSync(join(root, path), 'utf8'));
      if (match) title = match[1]!.trim();
    }
    return { path, title, kind: materialKind(path) };
  });
}

export function readKnowledge(root: string): KnowledgeSnapshot {
  return {
    methods: readMethods(root),
    cards: readCards(root),
    materials: readMaterials(root),
  };
}
