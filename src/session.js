import { chromium } from 'playwright';
import fs from 'node:fs';
import { config, urls, assertCredentials } from './config.js';

// Owns a single persistent, headless browser context and guarantees an
// authenticated session. ASP.NET WebForms auth lives in cookies
// (ASP.NET_SessionId + the app auth cookie); persisting the profile lets the
// session survive between MCP tool calls, and we re-login automatically when
// the server bounces us back to login.aspx.

let context = null;
let page = null;

export async function getPage() {
  if (page && !page.isClosed()) return page;
  await launch();
  await ensureLoggedIn();
  return page;
}

async function launch() {
  if (context) return;
  fs.mkdirSync(config.userDataDir, { recursive: true });
  context = await chromium.launchPersistentContext(config.userDataDir, {
    headless: config.headless,
    slowMo: config.slowMo,
    viewport: { width: 1512, height: 900 },
    locale: 'nb-NO',
    timezoneId: 'Europe/Oslo',
  });
  page = context.pages()[0] || (await context.newPage());
  page.setDefaultTimeout(30000);
}

// True when the current page is the login form.
async function onLoginPage() {
  const url = page.url();
  if (/login\.aspx/i.test(url)) return true;
  // Some WebForms apps keep the URL but render the form; check for the fields.
  return (await page.locator('input[type="password"]').count()) > 0;
}

export async function ensureLoggedIn() {
  assertCredentials();
  // Probe the app; if it redirects to login (or errors), authenticate.
  await page.goto(urls.declarations, { waitUntil: 'domcontentloaded' }).catch(() => {});
  if (await isAppPage()) return;
  await login();
}

async function isAppPage() {
  const url = page.url();
  if (/login\.aspx/i.test(url)) return false;
  // "Runtime Error" pages and expired tokens won't have the app chrome.
  const hasMenu = await page.getByText('Avslutt', { exact: false }).count().catch(() => 0);
  const hasGrid = await page.locator('table').count().catch(() => 0);
  return hasMenu > 0 && hasGrid > 0;
}

export async function login() {
  assertCredentials();
  await page.goto(urls.login, { waitUntil: 'domcontentloaded' });

  // The login form uses Norwegian labels: Brukernavn / Passord.
  const userField = page.locator(
    'input[name*="ser" i], input[id*="ser" i], input[type="text"]'
  ).first();
  const passField = page.locator('input[type="password"]').first();
  await userField.fill(config.user);
  await passField.fill(config.pass);

  // Submit: press Enter (posts the WebForms form) and wait for navigation.
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    passField.press('Enter'),
  ]);

  // If a dedicated submit button exists and Enter didn't post, click it.
  if (await onLoginPage()) {
    const btn = page
      .locator('a[href*="doPostBack" i], input[type="submit"], button, [id*="ogin" i][role]')
      .first();
    if (await btn.count()) {
      await Promise.all([
        page.waitForLoadState('networkidle').catch(() => {}),
        btn.click(),
      ]);
    }
  }

  if (await onLoginPage()) {
    throw new Error(
      'Login failed — still on login.aspx. Check EMMA_USER / EMMA_PASS, or set EMMA_HEADLESS=false to watch.'
    );
  }
}

export async function closeSession() {
  if (context) {
    await context.close().catch(() => {});
    context = null;
    page = null;
  }
}

// Run any navigation with an auto-relogin guard: if we land on the login page
// mid-flow (session expired), re-authenticate and retry once.
export async function withSession(fn) {
  const p = await getPage();
  let result = await fn(p);
  if (await onLoginPage()) {
    await login();
    result = await fn(page);
  }
  return result;
}
