import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

export const config = {
  baseUrl: (process.env.EMMA_BASE_URL || 'https://emmaedoc.no').replace(/\/$/, ''),
  user: process.env.EMMA_USER || '',
  pass: process.env.EMMA_PASS || '',
  headless: (process.env.EMMA_HEADLESS || 'true') !== 'false',
  slowMo: Number(process.env.EMMA_SLOWMO_MS || 0),
  // Persist the logged-in browser profile (cookies incl. ASP.NET_SessionId) here.
  userDataDir: path.join(ROOT, '.session'),
  dataDir: path.join(ROOT, 'data'),
  docsDir: path.join(ROOT, 'docs'),
};

export const urls = {
  login: `${config.baseUrl}/login.aspx`,
  // Main declarations grid ("oppdragsoversikt"). Reached after login.
  declarations: `${config.baseUrl}/Login/oppdragsoversiktNY2.aspx`,
};

export function assertCredentials() {
  if (!config.user || !config.pass) {
    throw new Error(
      'Missing EMMA_USER / EMMA_PASS. Copy .env.example to .env and fill in your credentials.'
    );
  }
}
