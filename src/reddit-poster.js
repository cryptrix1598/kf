import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const OPERA_PATH = 'C:\\Users\\joshy\\AppData\\Local\\Programs\\Opera GX\\opera.exe';
const CDP_PORT = 9222;

let cdpBrowser = null;
let connected = false;

export function isConnected() {
  return connected;
}

export async function launchOpera() {
  // First check if Opera is already running with CDP
  try {
    const test = await fetch(`http://localhost:${CDP_PORT}/json/version`).catch(() => null);
    if (test?.ok) {
      console.log('Opera GX already running with CDP. Connecting...');
      return await connectCDP();
    }
  } catch {}

  // Kill and restart
  try { execSync('taskkill /F /IM opera.exe 2>nul', { stdio: 'ignore' }); } catch {}
  await new Promise(r => setTimeout(r, 1000));

  console.log('Launching Opera GX with remote debugging...');
  spawn(OPERA_PATH, [`--remote-debugging-port=${CDP_PORT}`], { detached: true, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 6000));
  console.log('Opera GX opened. Log into Reddit in the Opera window.');
}

export async function connectCDP() {
  try {
    const test = await fetch(`http://localhost:${CDP_PORT}/json/version`).catch(() => null);
    if (!test?.ok) return false;

    if (cdpBrowser) {
      try { await cdpBrowser.close(); } catch {}
    }

    cdpBrowser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
    const page = await cdpBrowser.newPage();
    await page.goto('https://www.reddit.com/', { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const isLoggedIn = !page.url().includes('login');
    await page.close();

    connected = isLoggedIn;
    if (isLoggedIn) console.log('Connected to Reddit session via Opera!');
    return isLoggedIn;
  } catch (err) {
    console.error('CDP connection failed:', err.message);
    connected = false;
    return false;
  }
}

async function ensureConnected() {
  if (!connected || !cdpBrowser) {
    const ok = await connectCDP();
    if (!ok) throw new Error('Not connected to Opera. Launch Opera and log into Reddit first.');
  }
  // Verify connection is alive
  try {
    const p = await cdpBrowser.newPage();
    await p.close();
  } catch {
    connected = false;
    const ok = await connectCDP();
    if (!ok) throw new Error('Connection lost. Relaunch Opera.');
  }
}

export async function submitPost(subreddit, title, content, type = 'text') {
  await ensureConnected();
  const page = await cdpBrowser.newPage();

  try {
    await page.goto(`https://www.reddit.com/r/${subreddit}/submit`, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    if (page.url().includes('login')) {
      await page.close();
      connected = false;
      throw new Error('Session expired. Log into Reddit again.');
    }

    const titleInput = await page.$('#post-title, [slot="title"], textarea, input:not([type="hidden"])');
    if (!titleInput) throw new Error('Could not find title input');
    await titleInput.click();
    await titleInput.fill(title);
    await new Promise(r => setTimeout(r, 500));

    if (type === 'text' && content) {
      const bodyInput = await page.$('div[contenteditable="true"], textarea');
      if (bodyInput) {
        await bodyInput.click();
        await bodyInput.fill(content);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const submitBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Post")');
    if (submitBtn) {
      await submitBtn.click();
      await new Promise(r => setTimeout(r, 5000));
      return { success: true, title, subreddit };
    }

    throw new Error('Could not find submit button');
  } catch (err) {
    return { success: false, error: err.message, title, subreddit };
  } finally {
    await page.close();
  }
}
