export function readLessonAliases(source: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = source.split(/\r?\n/);
  const aliasesIndex = lines.findIndex((line) => /^## Aliases[ \t]*$/.test(line));
  if (aliasesIndex < 0) return result;
  for (const line of lines.slice(aliasesIndex + 1)) {
    if (/^## /.test(line)) break;
    const match = /^\s*[-*]\s*([^:]+):\s*(\S.*?)\s*$/.exec(line);
    if (match?.[1] && match[2]) result.set(match[1].trim(), match[2].trim());
  }
  return result;
}
