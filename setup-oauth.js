// One-time setup: creates a Reddit OAuth app from your browser session
import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const APP_NAME = 'KarmaFarmer';
const REDIRECT_URI = 'http://localhost:3000';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

console.log('🔴 Browser opened. Go to reddit.com and LOG IN manually.');
console.log('   Solve any CAPTCHA/challenges in the browser window.');
console.log('   Then press Enter here to continue...');

await new Promise(resolve => process.stdin.once('data', resolve));

console.log('\n📋 Navigating to Reddit app creation page...');
await page.goto('https://www.reddit.com/prefs/apps', { waitUntil: 'load', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

if (page.url().includes('login')) {
  console.log('❌ Not logged in. Redirected to login page.');
  console.log('   Log in manually in the browser, then press Enter...');
  await new Promise(resolve => process.stdin.once('data', resolve));
  await page.goto('https://www.reddit.com/prefs/apps', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
}

// Try clicking "create app" or "create another app" button
const createBtn = await page.$('button:has-text("create"), a:has-text("create"), #create-app-button');
if (createBtn) {
  await createBtn.click();
  await new Promise(r => setTimeout(r, 2000));
}

// Fill the form
console.log('📝 Filling app registration form...');

// Find form fields by label or placeholder
const nameInput = await page.$('#name, input[name="name"], input[placeholder*="name"]');
const radioScript = await page.$('input[type="radio"][value="script"], label:has-text("script") input');
const descriptionInput = await page.$('#description, textarea[name="description"], textarea[placeholder*="description"]');
const redirectInput = await page.$('#redirect_uri, input[name="redirect_uri"], input[placeholder*="redirect"]');
const submitBtn = await page.$('button[type="submit"], input[type="submit"]');

if (nameInput) {
  await nameInput.fill(APP_NAME);
  console.log('  ✓ Name filled');
}

if (radioScript) {
  await radioScript.click();
  console.log('  ✓ Script type selected');
} else {
  // Try clicking the label
  const scriptLabel = await page.$('label:has-text("script")');
  if (scriptLabel) await scriptLabel.click();
  console.log('  ✓ Script type clicked via label');
}

if (descriptionInput) {
  await descriptionInput.fill('AI-powered post generation assistant');
  console.log('  ✓ Description filled');
}

if (redirectInput) {
  await redirectInput.fill(REDIRECT_URI);
  console.log('  ✓ Redirect URI filled');
}

console.log('\n👆 Check the browser window. The form should be filled.');
console.log('   Click "create app" manually, then press Enter here...');
await new Promise(resolve => process.stdin.once('data', resolve));

await new Promise(r => setTimeout(r, 2000));

// Try to extract the client ID and secret from the page
console.log('\n🔍 Trying to extract app credentials...');

// The app list shows each app with its client ID
const pageText = await page.evaluate(() => document.body.innerText);

// Look for patterns like "personal use script" followed by a code
const idMatch = pageText.match(/personal use script[\s\S]*?([a-zA-Z0-9_-]{10,})/i);
const secretMatch = pageText.match(/secret[\s\S]*?([a-zA-Z0-9_-]{20,})/i);

if (idMatch) {
  const clientId = idMatch[1].trim();
  const clientSecret = secretMatch ? secretMatch[1].trim() : '';
  
  console.log(`\n✅ App created!`);
  console.log(`   Client ID: ${clientId}`);
  console.log(`   Secret: ${clientSecret ? clientSecret : '(not found - check the page)'}`);
  
  // Save to .env
  let envContent = '';
  const envPath = '.env';
  if (existsSync(envPath)) {
    envContent = require('fs').readFileSync(envPath, 'utf-8');
  }
  
  if (!envContent.includes('REDDIT_CLIENT_ID')) {
    envContent += `\n# Reddit OAuth (auto-setup)\nREDDIT_CLIENT_ID=${clientId}\n`;
    if (clientSecret) envContent += `REDDIT_CLIENT_SECRET=${clientSecret}\n`;
    writeFileSync(envPath, envContent);
    console.log('   Saved to .env');
  }
  
  console.log('\n✅ Setup complete! You can close the browser window.');
  console.log('   Now POSTING will use the Reddit API instead of Playwright.');
} else {
  console.log('\n⚠️ Could not auto-extract credentials.');
  console.log('   Find them manually on the page and add to .env:');
  console.log('   REDDIT_CLIENT_ID=your_id');
  console.log('   REDDIT_CLIENT_SECRET=your_secret');
}

await new Promise(r => setTimeout(r, 5000));
await browser.close();
