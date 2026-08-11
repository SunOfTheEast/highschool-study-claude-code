import { expect, test } from 'bun:test';
import { normalizeVTubeStudioModel } from '../../src/desktop/peer-live2d-import';

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
  expect(result.expressionCopies).toEqual({
    'lianhong.exp3.json': 'runtime/expressions/curious.exp3.json',
    'shengqi.exp3.json': 'runtime/expressions/skeptical.exp3.json',
  });
  expect(result.motionCopies).toEqual({
    'idle.motion3.json': 'runtime/motions/idle.motion3.json',
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
