import { chromium } from 'playwright';

let browser;
let context;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
  }
  return context;
}

export async function discoverRisingSubreddits() {
  const ctx = await getBrowser();
  const page = await ctx.newPage();
  const subreddits = [];

  try {
    await page.goto('https://www.reddit.com/r/popular/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);

    const posts = await page.evaluate(() => {
      const articles = document.querySelectorAll('article.w-full');
      const results = [];
      const seen = new Set();

      for (const article of articles) {
        const text = article.textContent || '';
        if (text.includes('Promoted') || text.includes('promoted')) continue;

        const titleEl = article.querySelector('a[slot="title"], a');
        const title = titleEl?.textContent?.trim() || '';

        if (!title || seen.has(title)) continue;
        seen.add(title);

        const subMatch = text.match(/r\/([a-zA-Z0-9_]+)/);
        const subreddit = subMatch ? subMatch[1] : '';

        if (!subreddit) continue;

        results.push({ subreddit, title });
      }
      return results.slice(0, 30);
    });

    const subMap = new Map();
    for (const post of posts) {
      if (!subMap.has(post.subreddit)) {
        subMap.set(post.subreddit, { name: post.subreddit, trendingPost: post.title, count: 0 });
      }
      const entry = subMap.get(post.subreddit);
      entry.count++;
      entry.trendingPost = post.title;
    }

    for (const [, data] of subMap) {
      subreddits.push({ name: data.name, trendingPost: data.trendingPost, postCount: data.count });
    }

    subreddits.sort((a, b) => b.postCount - a.postCount);
  } catch (err) {
    console.error('Scrape error:', err.message);
  } finally {
    await page.close();
  }

  return subreddits.slice(0, 10);
}

export async function getSubredditTrending(subredditName) {
  const ctx = await getBrowser();
  const page = await ctx.newPage();

  try {
    await page.goto(`https://www.reddit.com/r/${subredditName}/hot/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    return await page.evaluate(() => {
      const articles = document.querySelectorAll('article.w-full');
      return Array.from(articles).slice(0, 5).map(a => ({
        title: a.querySelector('a[slot="title"], a')?.textContent?.trim() || '',
        ups: 0,
      })).filter(p => p.title);
    });
  } catch (err) {
    console.error(`Error scraping r/${subredditName}:`, err.message);
    return [];
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
  }
}
