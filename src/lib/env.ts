/**
 * Environment configuration for the Umkhandlu GIS MCP.
 * Loads .env file when present (local development).
 * In production (Amazon Q CLI), env vars are injected via mcp.json env block.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env file if present — silently skip if missing
try {
  const dir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(dir, '../../.env');
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
} catch {
  // .env not present — rely on injected environment
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  controlCentreUrl: optional('CONTROL_CENTRE_URL', 'https://unami-platform-core-umkhandlu.vercel.app').replace(/\/$/, ''),
  operatorToken: optional('UMKHANDLU_OPERATOR_TOKEN'),
  sanityProjectId: optional('SANITY_PROJECT_ID', '60v9eb0r'),
  sanityDataset: optional('SANITY_DATASET', 'production'),
  sanityApiVersion: optional('SANITY_API_VERSION', '2024-08-22'),
  sanityReadToken: optional('SANITY_READ_TOKEN'),
  intelligenceApiKey: optional('INTELLIGENCE_API_KEY'),
  governanceNodeUrl: optional('GOVERNANCE_NODE_URL', 'https://umkhandlu.unamifoundation.org').replace(/\/$/, ''),
} as const;

export function requireOperatorToken(): string {
  if (!env.operatorToken) {
    throw new Error(
      'UMKHANDLU_OPERATOR_TOKEN is required for this operator tool. ' +
      'Set it in .env or in the mcp.json env block.'
    );
  }
  return env.operatorToken;
}
