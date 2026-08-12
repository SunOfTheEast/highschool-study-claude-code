import { expect, test } from 'bun:test';
import {
  mergeVTubeExpression,
  normalizeVTubeStudioModel,
} from '../../src/desktop/peer-live2d-import';

const model = {
  Version: 3,
  FileReferences: {
    Moc: 'source.moc3',
    Textures: ['source.8192/texture_00.png', 'source.8192/texture_01.png'],
    Physics: 'source.physics3.json',
    DisplayInfo: 'source.cdi3.json',
  },
  Groups: [],
};

const vtube = {
  FileReferences: { Model: 'source.model3.json', IdleAnimation: 'idle.motion3.json' },
  Hotkeys: [
    { Name: '', Action: 'ToggleExpression', File: 'X.exp3.json', Triggers: { Trigger1: 'X' } },
    { Name: 'lianhong', Action: 'ToggleExpression', File: 'lianhong.exp3.json' },
    { Name: 'shengqi', Action: 'ToggleExpression', File: 'shengqi.exp3.json' },
  ],
};

const displayInfo = {
  Version: 3,
  Parameters: [{ Id: 'ParamMouthOpenY', GroupId: '', Name: '嘴巴开合' }],
};

const files = [
  'source.model3.json',
  'source.moc3',
  'source.8192/texture_00.png',
  'source.8192/texture_01.png',
  'source.physics3.json',
  'source.cdi3.json',
  'idle.motion3.json',
  'X.exp3.json',
  'lianhong.exp3.json',
  'shengqi.exp3.json',
];

test('turns one VTube Studio package into the strict StudyForge actor slot', () => {
  const result = normalizeVTubeStudioModel({
    modelFile: 'source.model3.json',
    model,
    vtube,
    displayInfo,
    files,
  });
  const references = result.model.FileReferences;

  expect(references.Expressions.map((entry) => entry.Name))
    .toEqual(['neutral', 'curious', 'skeptical']);
  expect(references.Motions.Idle.at(0)?.File).toBe('motions/idle.motion3.json');
  expect(references.Textures).toEqual([
    'textures/texture_00.png',
    'textures/texture_01.png',
  ]);
  expect(result.manifest.modelFiles).toContain('runtime/textures/texture_00.png');
  expect(new Set(result.manifest.modelFiles).size).toBe(result.manifest.modelFiles.length);
  expect(result.expressionCopies).toEqual({
    'X.exp3.json': 'runtime/expressions/neutral.exp3.json',
    'lianhong.exp3.json': 'runtime/expressions/curious.exp3.json',
    'shengqi.exp3.json': 'runtime/expressions/skeptical.exp3.json',
  });
  expect(result.motionCopies).toEqual({
    'idle.motion3.json': 'runtime/motions/idle.motion3.json',
  });
});

test('keeps the package visibility toggle active across peer expressions', () => {
  expect(mergeVTubeExpression(
    {
      Type: 'Live2D Expression',
      Parameters: [{ Id: 'ParamVisibility', Value: 30, Blend: 'Add' }],
    },
    {
      Type: 'Live2D Expression',
      Parameters: [{ Id: 'ParamEmotion', Value: 1 }],
    },
  )).toEqual({
    Type: 'Live2D Expression',
    Parameters: [
      { Id: 'ParamVisibility', Value: 30, Blend: 'Add' },
      { Id: 'ParamEmotion', Value: 1 },
    ],
  });
});

test('rejects a package missing an exact required file or mouth parameter', () => {
  expect(() => normalizeVTubeStudioModel({
    modelFile: 'source.model3.json', model, vtube, displayInfo, files: files.slice(0, -1),
  })).toThrow('LIVE2D_SOURCE_INCOMPLETE');
  expect(() => normalizeVTubeStudioModel({
    modelFile: 'source.model3.json',
    model,
    vtube,
    displayInfo: { Version: 3, Parameters: [] },
    files,
  })).toThrow('LIVE2D_SOURCE_INCOMPLETE');
});
