import { afterEach, expect, test } from 'bun:test';
import { delimiter } from 'node:path';
import {
  configureStudySubagentDirectory,
  resolveStudySubagentDirectory,
  studySubagentDirectory,
} from '../../src/runtime/subagent-path';

const original = process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS;
const originalResourceRoot = process.env.STUDYFORGE_RESOURCE_ROOT;

afterEach(() => {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = original;
  process.env.STUDYFORGE_RESOURCE_ROOT = originalResourceRoot;
});

test('appends the packaged Scout directory without replacing existing directories', () => {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = '/tmp/existing-subagents';
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter)).toEqual([
    '/tmp/existing-subagents',
    studySubagentDirectory,
  ]);
});

test('does not duplicate the packaged Scout directory', () => {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = studySubagentDirectory;
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS).toBe(studySubagentDirectory);
});

test('resolves the Scout directory from the packaged resource root', () => {
  process.env.STUDYFORGE_RESOURCE_ROOT = '/Applications/StudyForge.app/Contents/Resources/studyforge';
  expect(resolveStudySubagentDirectory()).toBe(
    '/Applications/StudyForge.app/Contents/Resources/studyforge/subagents',
  );
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = '/tmp/existing-subagents';
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter)).toEqual([
    '/tmp/existing-subagents',
    '/Applications/StudyForge.app/Contents/Resources/studyforge/subagents',
  ]);
});
