import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

let browser;
let context;
let loggedIn = false;

export async function loginWithCookies(cookieJson) {
  if (browser) await browser.close();

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const cookies = typeof cookieJson === 'string' ? JSON.parse(cookieJson) : cookieJson;
  await context.addCookies(cookies);
  loggedIn = true;
  console.log('Cookies loaded, logged into Reddit');
  return true;
}

export async function setCookiesFromBrowser() {
  return false; // placeholder
}

export async function submitPost(subreddit, title, content, type = 'text') {
  if (!loggedIn || !browser) {
    throw new Error('Not logged in. Provide cookies first.');
  }

  const postPage = await context.newPage();

  try {
    await postPage.goto(`https://www.reddit.com/r/${subreddit}/submit`, { waitUntil: 'load', timeout: 30000 });
    await postPage.waitForTimeout(3000);

    const url = postPage.url();
    if (url.includes('login')) {
      loggedIn = false;
      throw new Error('Session expired. Re-export cookies.');
    }

    await postPage.waitForSelector('#post-title, [slot="title"], input, textarea', { timeout: 10000 }).catch(() => {});
    await postPage.waitForTimeout(1000);

    const titleInput = await postPage.$('#post-title') || await postPage.$('textarea') || await postPage.$('input:not([type="hidden"])');
    if (!titleInput) throw new Error('Could not find title input');

    await titleInput.click();
    await titleInput.fill(title);
    await postPage.waitForTimeout(500);

    const bodyInput = await postPage.$('div[contenteditable="true"], textarea#text, textarea');
    if (type === 'text' && content && bodyInput && await bodyInput.getAttribute('id') !== 'post-title') {
      await bodyInput.click();
      await bodyInput.fill(content);
      await postPage.waitForTimeout(500);
    }

    const submitBtn = await postPage.$('button[type="submit"]') || await postPage.$('button:has-text("Post")');
    if (submitBtn) {
      await submitBtn.click();
      await postPage.waitForTimeout(5000);
      console.log(`Posted to r/${subreddit}: "${title}"`);
      return { success: true, title, subreddit };
    }

    throw new Error('Could not find submit button');
  } catch (err) {
    console.error(`Failed to post to r/${subreddit}:`, err.message);
    return { success: false, error: err.message, title, subreddit };
  } finally {
    await postPage.close();
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    loggedIn = false;
  }
}
