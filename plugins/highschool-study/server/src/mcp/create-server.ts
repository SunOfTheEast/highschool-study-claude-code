import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStudyTools, type StudyMcpDependencies } from './register-tools';

export function createStudyMcpServer(deps: StudyMcpDependencies): McpServer {
  const server = new McpServer(
    { name: 'study-markdown', version: '0.1.0' },
    { capabilities: {} },
  );
  registerStudyTools(server, deps);
  return server;
}
