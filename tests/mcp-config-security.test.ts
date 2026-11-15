import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('tracked MCP configuration security', () => {
  it('does not embed credential-bearing environment variables', () => {
    const configPath = resolve(process.cwd(), 'mcp.json');
    const config: {
      mcpServers?: Record<string, { env?: Record<string, string> }>;
    } = JSON.parse(readFileSync(configPath, 'utf8'));
    const configuredNames = Object.values(config.mcpServers ?? {}).flatMap(
      (server) => Object.keys(server.env ?? {}),
    );

    expect(configuredNames).not.toContain('SANITY_READ_TOKEN');
    expect(configuredNames).not.toContain('INTELLIGENCE_API_KEY');
    expect(configuredNames).not.toContain('UMKHANDLU_OPERATOR_TOKEN');
  });
});
