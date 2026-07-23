import { expect, test } from 'bun:test';
import { delimiter } from 'node:path';
import {
  configureStudySubagentDirectory,
  studySubagentDirectory,
} from '../../src/runtime/subagent-path';

test('adds the packaged study subagent directory without replacing existing directories', () => {
  const previous = process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS;
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = '/tmp/existing';
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter)).toEqual([
    '/tmp/existing', studySubagentDirectory,
  ]);
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = previous;
});
