import { chromium } from 'playwright';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const APP_NAME = 'KarmaFarmer';
const REDIRECT_URI = 'http://localhost:3000';
const { REDDIT_USERNAME, REDDIT_PASSWORD } = process.env;

if (!REDDIT_USERNAME || !REDDIT_PASSWORD) {
  console.error('❌ Set REDDIT_USERNAME and REDDIT_PASSWORD in .env first');
  process.exit(1);
}

console.log('🚀 Launching Opera GX...');
const browser = await chromium.launch({
  executablePath: 'C:\\Users\\joshy\\AppData\\Local\\Programs\\Opera GX\\opera.exe',
  headless: false,
});
const page = await browser.newPage();

// Navigate to login
await page.goto('https://www.reddit.com/login/', { waitUntil: 'load', timeout: 30000 });
console.log('⏳ Waiting for login form...');
await new Promise(r => setTimeout(r, 5000));

// Check if we need to handle the JS challenge first
const url = page.url();
if (url.includes('js_challenge')) {
  console.log('🔄 JS challenge detected, waiting for it to resolve...');
  await new Promise(r => setTimeout(r, 8000));
}

// Try to fill credentials
const usernameInput = await page.$('input[autocomplete="username"], input[name="username"]');
const passwordInput = await page.$('input[autocomplete="current-password"], input[type="password"]');

if (usernameInput && passwordInput) {
  console.log('🔑 Filling credentials...');
  await usernameInput.fill(REDDIT_USERNAME);
  await passwordInput.fill(REDDIT_PASSWORD);
  await new Promise(r => setTimeout(r, 500));

  const loginBtn = await page.$('button:has-text("Log In")');
  if (loginBtn) {
    await loginBtn.click();
    console.log('⏳ Logging in...');
    await new Promise(r => setTimeout(r, 8000));
  }
}

// Check if login succeeded
const currentUrl = page.url();
console.log(`📍 After login URL: ${currentUrl}`);

if (currentUrl.includes('login') && !currentUrl.includes('prefs')) {
  console.log('\n⚠️ Could not auto-login. Log in MANUALLY in the Edge window.');
  console.log('   Then press Enter here to continue...');
  await new Promise(resolve => process.stdin.once('data', resolve));
}

// Navigate to apps page
console.log('📋 Navigating to app creation page...');
await page.goto('https://www.reddit.com/prefs/apps', { waitUntil: 'load', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

// Check if we landed on login page
if (page.url().includes('login')) {
  console.log('⚠️ Redirected to login. Log in manually, press Enter...');
  await new Promise(resolve => process.stdin.once('data', resolve));
  await page.goto('https://www.reddit.com/prefs/apps', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
}

// Find and click "create app" button
const createBtn = await page.$('button:has-text("create app"), button:has-text("Create App"), a:has-text("create app"), #create-app-button');
if (createBtn) {
  await createBtn.click();
  await new Promise(r => setTimeout(r, 2000));
  console.log('📝 Form should be open');
} else {
  console.log('⚠️ Could not find create button. Check the Edge window.');
}

// Fill form
const nameInput = await page.$('#name, input[name="name"]');
const scriptRadio = await page.$('input[type="radio"][value="script"]');
const descInput = await page.$('#description, textarea[name="description"]');
const redirectInput = await page.$('#redirect_uri, input[name="redirect_uri"]');

if (nameInput) { await nameInput.fill(APP_NAME); console.log('  ✓ Name'); }
if (scriptRadio) { await scriptRadio.click(); console.log('  ✓ Script type'); }
if (descInput) { await descInput.fill('AI post generator'); console.log('  ✓ Description'); }
if (redirectInput) { await redirectInput.fill(REDIRECT_URI); console.log('  ✓ Redirect URI'); }

console.log('\n👆 Check the Edge window. Click "create app" manually, then press Enter...');
await new Promise(resolve => process.stdin.once('data', resolve));
await new Promise(r => setTimeout(r, 2000));

// Extract credentials
const bodyText = await page.evaluate(() => document.body.innerText);
const idMatch = bodyText.match(/personal use script[\s\S]{0,200}?([a-zA-Z0-9_-]{15,})/i);
const secretMatch = bodyText.match(/secret[\s\S]{0,200}?([a-zA-Z0-9_-]{20,})/i);

if (idMatch) {
  const clientId = idMatch[1].trim();
  const clientSecret = secretMatch ? secretMatch[1].trim() : '';
  console.log(`\n✅ App created! Client ID: ${clientId}`);

  let env = readFileSync('.env', 'utf-8');
  if (!env.includes('REDDIT_CLIENT_ID')) {
    env += `\nREDDIT_CLIENT_ID=${clientId}\n`;
    if (clientSecret) env += `REDDIT_CLIENT_SECRET=${clientSecret}\n`;
    writeFileSync('.env', env);
    console.log('✅ Saved to .env');
  }
} else {
  console.log('\n⚠️ Could not extract credentials. Find them on the page and add to .env:');
  console.log('   REDDIT_CLIENT_ID=your_id');
  console.log('   REDDIT_CLIENT_SECRET=your_secret');
}

console.log('\n✅ Setup complete! Close the Edge window and run: npm start');
await new Promise(r => setTimeout(r, 3000));
await browser.close();
