import { expect, test } from 'bun:test';

test('exports one shared study-domain entry for non-MCP runtimes', async () => {
  const domain = await import('highschool-study-markdown/study-domain');
  for (const name of [
    'searchCards',
    'searchTraces',
    'appendTrace',
    'sourceResolve',
    'readActiveTraces',
    'aggregateMethodSignals',
    'resolveTraceMethods',
    'readMarkdownFile',
    'resolveInsideRoot',
  ]) expect(domain[name as keyof typeof domain]).toBeFunction();
});
