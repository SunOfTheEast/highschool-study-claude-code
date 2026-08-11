import { posix } from 'node:path';
import type { PeerLive2DManifest } from '../shared/contracts';

type JsonObject = Record<string, unknown>;

export type VTubeStudioModelInput = {
  modelFile: string;
  model: unknown;
  vtube: unknown;
  displayInfo: unknown;
  files: readonly string[];
};

export type NormalizedLive2DModel = JsonObject & {
  Version: 3;
  FileReferences: {
    Moc: string;
    Textures: string[];
    Physics: string;
    DisplayInfo: string;
    Expressions: Array<{ Name: 'neutral' | 'curious' | 'skeptical'; File: string }>;
    Motions: { Idle: Array<{ File: string }> };
  };
};

export type NormalizedVTubeStudioModel = {
  model: NormalizedLive2DModel;
  manifest: PeerLive2DManifest;
  staticCopies: Record<string, string>;
  expressionCopies: Record<string, string>;
  motionCopies: Record<string, string>;
  textureCopies: Record<string, string>;
  generatedFiles: Record<string, JsonObject>;
};

function incomplete(): never {
  throw new Error('LIVE2D_SOURCE_INCOMPLETE');
}

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) incomplete();
  return value as JsonObject;
}

function relativeFile(value: unknown): string {
  if (typeof value !== 'string'
    || !value
    || value.includes('\\')
    || value.includes('\0')
    || posix.isAbsolute(value)
    || posix.normalize(value) !== value
    || value.startsWith('../')) incomplete();
  return value;
}

function sourceFile(value: unknown, files: ReadonlySet<string>): string {
  const path = relativeFile(value);
  if (!files.has(path)) incomplete();
  return path;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string')) {
    incomplete();
  }
  return value as string[];
}

function expressionFile(vtube: JsonObject, name: string, files: ReadonlySet<string>): string {
  const hotkeys = vtube.Hotkeys;
  if (!Array.isArray(hotkeys)) incomplete();
  const hotkey = hotkeys.find((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as JsonObject;
    return candidate.Name === name && candidate.Action === 'ToggleExpression';
  });
  return sourceFile(object(hotkey).File, files);
}

export function normalizeVTubeStudioModel(
  input: VTubeStudioModelInput,
): NormalizedVTubeStudioModel {
  const model = object(input.model);
  const vtube = object(input.vtube);
  const displayInfo = object(input.displayInfo);
  const files = new Set(input.files.map(relativeFile));
  const modelFile = sourceFile(input.modelFile, files);
  const sourceReferences = object(model.FileReferences);
  const vtubeReferences = object(vtube.FileReferences);
  if (vtubeReferences.Model !== modelFile) incomplete();

  const moc = sourceFile(sourceReferences.Moc, files);
  const physics = sourceFile(sourceReferences.Physics, files);
  const display = sourceFile(sourceReferences.DisplayInfo, files);
  const textures = stringArray(sourceReferences.Textures).map((path) => sourceFile(path, files));
  if (new Set(textures).size !== textures.length) incomplete();
  const idle = sourceFile(vtubeReferences.IdleAnimation, files);
  const curious = expressionFile(vtube, 'lianhong', files);
  const skeptical = expressionFile(vtube, 'shengqi', files);

  const parameters = displayInfo.Parameters;
  if (!Array.isArray(parameters) || !parameters.some((value) => (
    value && typeof value === 'object' && !Array.isArray(value)
      && (value as JsonObject).Id === 'ParamMouthOpenY'
  ))) incomplete();

  const textureCopies: Record<string, string> = {};
  const normalizedTextures = textures.map((source, index) => {
    const name = `texture_${String(index).padStart(2, '0')}.png`;
    textureCopies[source] = `runtime/textures/${name}`;
    return `textures/${name}`;
  });
  const normalized: NormalizedLive2DModel = {
    ...model,
    Version: 3,
    FileReferences: {
      Moc: 'axia.moc3',
      Textures: normalizedTextures,
      Physics: 'axia.physics3.json',
      DisplayInfo: 'axia.cdi3.json',
      Expressions: [
        { Name: 'neutral', File: 'expressions/neutral.exp3.json' },
        { Name: 'curious', File: 'expressions/curious.exp3.json' },
        { Name: 'skeptical', File: 'expressions/skeptical.exp3.json' },
      ],
      Motions: { Idle: [{ File: 'motions/idle.motion3.json' }] },
    },
  };

  const expressionCopies = {
    [curious]: 'runtime/expressions/curious.exp3.json',
    [skeptical]: 'runtime/expressions/skeptical.exp3.json',
  };
  const motionCopies = { [idle]: 'runtime/motions/idle.motion3.json' };
  const staticCopies = {
    [moc]: 'runtime/axia.moc3',
    [physics]: 'runtime/axia.physics3.json',
    [display]: 'runtime/axia.cdi3.json',
  };
  const generatedFiles = {
    'runtime/axia.model3.json': normalized,
    'runtime/expressions/neutral.exp3.json': {
      Type: 'Live2D Expression',
      Parameters: [],
    },
  };
  const modelFiles = [
    'runtime/axia.model3.json',
    ...Object.values(staticCopies),
    'runtime/expressions/neutral.exp3.json',
    ...Object.values(expressionCopies),
    ...Object.values(motionCopies),
    ...Object.values(textureCopies),
  ];

  return {
    model: normalized,
    manifest: {
      version: 1,
      modelFile: 'runtime/axia.model3.json',
      coreFile: 'runtime/live2dcubismcore.min.js',
      modelFiles,
    },
    staticCopies,
    expressionCopies,
    motionCopies,
    textureCopies,
    generatedFiles,
  };
}
