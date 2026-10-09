/**
 * Functional test for the web login PoC.
 *
 * Loads web/login.html in headless Chrome and exercises the real flow:
 *   1. page renders brand, fields and both actions
 *   2. empty submit -> "Fields required" banner
 *   3. wrong credentials -> "Invalid credentials" banner
 *   4. correct credentials -> session-established state
 *   5. password toggle flips input type
 *
 * Run:  node test-login.mjs
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// puppeteer is installed in frontend/node_modules — resolve it from there
// so this script can live next to the page it tests.
const require = createRequire('D:/Journal Trade/frontend/package.json');
const puppeteer = require('puppeteer');

const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const PAGE = pathToFileURL(path.join(HERE, 'login.html')).href;

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${extra ? ' :: ' + extra : ''}`);
  }
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  // Unique profile per run so a stale Chrome from an earlier attempt
  // can't block the launch.
  userDataDir: path.join(
    process.env.TMPDIR || 'C:/Users/virga/AppData/Local/Temp',
    `pptr-login-${Date.now()}`
  ),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage();

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});

await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 15000 });
// Wait for the form to be interactive (inline script runs synchronously)
await page.waitForSelector('#loginForm', { timeout: 5000 });

console.log('\n[1] render');
const text = await page.evaluate(() => document.body.innerText);
check('brand wordmark', text.includes('HUNTER TRADES'));
check('username label', text.includes('USERNAME'));
check('password label', text.includes('PASSWORD'));
check('primary action', text.includes('INITIALIZE SESSION'));
check('biometric action', text.includes('Biometric Auth'));
check('status footer', text.includes('SYSTEM ONLINE'));

console.log('\n[2] empty submit');
await page.click('#submitBtn');
// Page has a 1200ms simulated auth delay before showing error
await new Promise((r) => setTimeout(r, 1800));
let body = await page.evaluate(() => document.body.innerText);
check('error banner appears', body.includes('ACCESS DENIED'), body.slice(0, 120));

console.log('\n[3] wrong credentials');
await page.type('#username', 'nope');
await page.type('#password', 'wrong');
await page.click('#submitBtn');
await new Promise((r) => setTimeout(r, 1800));
body = await page.evaluate(() => document.body.innerText);
check('invalid-credentials banner', body.includes('Invalid credentials'), body.slice(0, 120));
check('button re-enabled', await page.$eval('#submitBtn', (b) => !b.disabled));

console.log('\n[4] password toggle');
await page.evaluate(() => {
  document.getElementById('password').value = '';
});
await page.type('#password', 'secret');
const before = await page.$eval('#password', (i) => i.type);
await page.evaluate(() => {
  document.querySelector('button[onclick="togglePassword()"]').click();
});
const after = await page.$eval('#password', (i) => i.type);
check('toggles to text', before === 'password' && after === 'text', `${before} -> ${after}`);

console.log('\n[5] correct credentials');
await page.evaluate(() => {
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
});
await page.type('#username', 'admin');
await page.type('#password', 'hunter');
await page.click('#submitBtn');
await new Promise((r) => setTimeout(r, 2600));
body = await page.evaluate(() => document.body.innerText);
check('session established', body.includes('CONNECTED'), body.slice(0, 160));
check('welcome shows username', body.includes('Welcome, admin'), body.slice(0, 160));

console.log('\n[6] no runtime errors');
check('clean console', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
