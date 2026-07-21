import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { delimiter } from 'node:path';
import {
  configureStudySubagentDirectory,
  studySubagentDirectory,
} from '../../src/runtime/subagent-path';

test('exposes one mutation-free study subagent directory', () => {
  const source = readFileSync(`${studySubagentDirectory}/study-scout.md`, 'utf8');
  expect(source).toContain('name: study-scout');
  expect(source).toContain('tools: read, grep, find, ls');
  for (const forbidden of ['tools: write', 'tools: edit', 'tools: bash', 'tools: subagent']) {
    expect(source).not.toContain(forbidden);
  }

  const previous = process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS;
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = '/tmp/existing';
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter)).toEqual([
    '/tmp/existing', studySubagentDirectory,
  ]);
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = previous;
});
