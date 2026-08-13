import { afterEach, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
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
  const existing = join(tmpdir(), 'existing-subagents');
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = existing;
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter)).toEqual([
    existing,
    studySubagentDirectory,
  ]);
});

test('does not duplicate the packaged Scout directory', () => {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = studySubagentDirectory;
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS).toBe(studySubagentDirectory);
});

test('resolves the Scout directory from the packaged resource root', () => {
  const resourceRoot = join(tmpdir(), 'StudyForge Resources', 'studyforge');
  const existing = join(tmpdir(), 'existing-subagents');
  process.env.STUDYFORGE_RESOURCE_ROOT = resourceRoot;
  expect(resolveStudySubagentDirectory()).toBe(join(resourceRoot, 'subagents'));
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = existing;
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter)).toEqual([
    existing,
    join(resourceRoot, 'subagents'),
  ]);
});
