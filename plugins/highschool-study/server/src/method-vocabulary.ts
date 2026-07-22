import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { resolveInsideRoot } from './learning-set';

export type TraceMethods = {
  primary: string;
  secondary: string[];
};

export type TraceMethodInput = {
  primary: string;
  secondary?: string[] | undefined;
};

export type MethodResolution = {
  methods: TraceMethods | null;
  unresolved: string[];
};

type VocabularyNode = {
  facet?: unknown;
  canonical_name?: unknown;
  aliases?: unknown;
};

type MethodVocabulary = {
  canonical: Set<string>;
  aliases: Map<string, Set<string>>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
    : [];
}

function addAlias(vocabulary: MethodVocabulary, alias: string, canonical: string): void {
  const targets = vocabulary.aliases.get(alias) ?? new Set<string>();
  targets.add(canonical);
  vocabulary.aliases.set(alias, targets);
}

function readYaml(root: string, path: string): unknown | null {
  const absolute = resolveInsideRoot(root, path);
  if (!existsSync(absolute)) return null;
  try {
    return parse(readFileSync(absolute, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function vocabulary(root: string): MethodVocabulary {
  const result: MethodVocabulary = { canonical: new Set<string>(), aliases: new Map() };
  const source = asRecord(readYaml(root, join('graph', 'vocabulary.yaml')));
  if (source !== null) {
    for (const node of Array.isArray(source.nodes) ? source.nodes : []) {
      const record = asRecord(node) as VocabularyNode | null;
      const facet = record?.facet;
      const canonical = typeof record?.canonical_name === 'string' ? record.canonical_name.trim() : '';
      if (!canonical || (facet !== 'method_cluster' && facet !== 'method_subroute')) continue;
      result.canonical.add(canonical);
      for (const alias of strings(record?.aliases)) addAlias(result, alias, canonical);
    }
    for (const value of Array.isArray(source.method_clusters) ? source.method_clusters : []) {
      if (typeof value === 'string' && value.trim()) result.canonical.add(value.trim());
      else {
        const record = asRecord(value);
        const canonical = typeof record?.canonical_name === 'string' ? record.canonical_name.trim() : '';
        if (canonical) result.canonical.add(canonical);
      }
    }
  }

  const aliases = asRecord(readYaml(root, join('graph', 'aliases.yaml')));
  for (const group of Array.isArray(aliases?.alias_groups) ? aliases.alias_groups : []) {
    const record = asRecord(group);
    if (record === null) continue;
    const targets = Array.isArray(record.maps_to)
      ? record.maps_to
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null && item.layer === 'method')
        .map((item) => typeof item.value === 'string' ? item.value.trim() : '')
        .filter((value) => value.length > 0 && result.canonical.has(value))
      : [];
    const uniqueTargets = [...new Set(targets)];
    for (const alias of strings(record.aliases)) {
      for (const target of uniqueTargets) addAlias(result, alias, target);
      if (uniqueTargets.length > 1) {
        const existing = result.aliases.get(alias) ?? new Set<string>();
        for (const target of uniqueTargets) existing.add(target);
        result.aliases.set(alias, existing);
      }
    }
  }
  return result;
}

function resolveOne(value: string, vocabularyData: MethodVocabulary): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (vocabularyData.canonical.has(normalized)) return normalized;
  const targets = vocabularyData.aliases.get(normalized);
  return targets?.size === 1 ? [...targets][0]! : null;
}

export function resolveTraceMethods(
  root: string,
  input: TraceMethodInput | null | undefined,
): MethodResolution {
  if (input === null || input === undefined) return { methods: null, unresolved: [] };
  const vocabularyData = vocabulary(root);
  const raw = [input.primary, ...(input.secondary ?? [])];
  const unresolved: string[] = [];
  const resolved: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !value.trim()) {
      if (typeof value === 'string') unresolved.push(value);
      continue;
    }
    const canonical = resolveOne(value, vocabularyData);
    if (canonical === null) unresolved.push(value.trim());
    else if (!resolved.includes(canonical)) resolved.push(canonical);
  }
  if (unresolved.length > 0 || resolved.length === 0 || typeof input.primary !== 'string') {
    return { methods: null, unresolved: [...new Set(unresolved)] };
  }
  const [primary, ...secondary] = resolved;
  return { methods: { primary: primary!, secondary }, unresolved: [] };
}
