import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, r));

const OPERA_GX = 'C:\\Users\\joshy\\AppData\\Local\\Programs\\Opera GX\\opera.exe';

console.log('\n══════════════════════════════════════════');
console.log('  REDDIT API SETUP');
console.log('══════════════════════════════════════════\n');

// Step 1: Open Reddit login in Opera GX
spawn(OPERA_GX, ['https://www.reddit.com/login/']);
console.log('1️⃣  Opera GX opened to Reddit login.');
console.log('   Log into your Reddit account there.\n');

await ask('   Press Enter once logged in...');

// Step 2: Open the apps page
spawn(OPERA_GX, ['https://www.reddit.com/prefs/apps']);
console.log('\n2️⃣  Apps page opened in Opera GX.');
console.log('   Scroll down and click "Create App" or "Create Another App".\n');
console.log('   Fill in:');
console.log('     • Name: KarmaFarmer');
console.log('     • Type: script');
console.log('     • Description: (anything)');
console.log('     • Redirect URI: http://localhost:3000');
console.log('   Then click "create app".\n');

await ask('   Press Enter after creating the app...');

// Step 3: Extract credentials
console.log('\n3️⃣  Find the app you just created under "Developed Applications".');
console.log('   Copy the following and paste them below:\n');

const clientId = await ask('   Client ID (the string under "personal use script"): ');
const clientSecret = await ask('   Secret: ');

if (clientId) {
  let env = readFileSync('.env', 'utf-8');
  if (!env.includes('REDDIT_CLIENT_ID')) {
    env += `\n# Reddit OAuth\nREDDIT_CLIENT_ID=${clientId.trim()}\n`;
    if (clientSecret) env += `REDDIT_CLIENT_SECRET=${clientSecret.trim()}\n`;
    writeFileSync('.env', env);
    console.log('\n✅ Saved to .env!');
  } else {
    console.log('\n⚠️ REDDIT_CLIENT_ID already in .env');
  }
} else {
  console.log('\n⚠️ No client ID entered. Add it manually to .env later.');
}

console.log('\n✅ Setup complete! Run: npm start');
rl.close();
