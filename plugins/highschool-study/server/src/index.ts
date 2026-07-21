import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config';
import { createStudyMcpServer } from './mcp/create-server';

export async function startStudyMcp(
  env: Record<string, string | undefined> = process.env,
): Promise<ReturnType<typeof createStudyMcpServer>> {
  const config = loadConfig(env);
  const server = createStudyMcpServer({
    learningSetRoot: config.learningSetRoot,
    now: () => new Date(),
  });
  await server.connect(new StdioServerTransport());
  return server;
}

if (import.meta.main) await startStudyMcp();
