import { afterEach, expect, test } from 'bun:test';
import { delimiter } from 'node:path';
import {
  configureStudySubagentDirectory,
  studySubagentDirectory,
} from '../../src/runtime/subagent-path';

const original = process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS;

afterEach(() => {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = original;
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
