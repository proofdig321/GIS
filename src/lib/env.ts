/**
 * Environment configuration for the Umkhandlu GIS MCP.
 * All credentials come from environment variables — never from source code.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  controlCentreUrl: optional('CONTROL_CENTRE_URL', 'https://unami-platform-core-umkhandlu.vercel.app').replace(/\/$/, ''),
  operatorToken: optional('UMKHANDLU_OPERATOR_TOKEN'),
  sanityProjectId: optional('SANITY_PROJECT_ID', '60v9eb0r'),
  sanityDataset: optional('SANITY_DATASET', 'production'),
  sanityApiVersion: optional('SANITY_API_VERSION', '2026-01-01'),
  sanityReadToken: optional('SANITY_READ_TOKEN'),
  intelligenceApiKey: optional('INTELLIGENCE_API_KEY'),
  governanceNodeUrl: optional('GOVERNANCE_NODE_URL', 'https://umkhandlu.unamifoundation.org').replace(/\/$/, ''),
} as const;

export function requireOperatorToken(): string {
  if (!env.operatorToken) {
    throw new Error(
      'UMKHANDLU_OPERATOR_TOKEN is required for this operator tool. ' +
      'Set it in your .env file.'
    );
  }
  return env.operatorToken;
}
