import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import {
  configureStudySubagentDirectory,
  studyReadonlyToolsPath,
  studySubagentRuntimeDirectory,
} from '../../src/runtime/subagent-path';

test('adds a runtime agent definition with an absolute read-only extension path', () => {
  const previous = process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS;
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = '/tmp/existing';
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter)).toEqual([
    '/tmp/existing', studySubagentRuntimeDirectory,
  ]);
  expect(readFileSync(join(studySubagentRuntimeDirectory, 'study-scout.md'), 'utf8'))
    .toContain(`subagentOnlyExtensions: ${studyReadonlyToolsPath}`);
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = previous;
});
