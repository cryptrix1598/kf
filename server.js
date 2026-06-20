import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePost, generateReply } from './src/ai-client.js';
import { discoverRisingSubreddits, getSubredditTrending, closeBrowser as closeScraper } from './src/reddit-scraper.js';
import { submitPost, loginToReddit } from './src/reddit-poster.js';
import { postQueue } from './src/post-queue.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let autoGenerateInterval = null;
let isGenerating = false;
let redditConnected = false;

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    redditConnected,
    autoGenerate: autoGenerateInterval !== null,
    generating: isGenerating,
  });
});

app.get('/api/queue', (req, res) => {
  res.json({ queue: postQueue.getAll() });
});

app.get('/api/history', (req, res) => {
  res.json({ history: postQueue.getHistory() });
});

app.get('/api/stats', (req, res) => {
  res.json(postQueue.getStats());
});

app.post('/api/generate', async (req, res) => {
  if (isGenerating) {
    return res.status(429).json({ error: 'Already generating' });
  }
  isGenerating = true;

  try {
    console.log('Discovering rising subreddits...');
    const subreddits = await discoverRisingSubreddits();

    if (subreddits.length === 0) {
      return res.status(500).json({ error: 'Could not discover subreddits' });
    }

    console.log(`Found ${subreddits.length} subreddits. Generating post with AI...`);
    const post = await generatePost(subreddits);

    if (!post) {
      return res.status(500).json({ error: 'AI failed to generate post' });
    }

    const entry = postQueue.add(post);
    console.log(`Generated post for r/${post.subreddit}: "${post.title}"`);
    res.json({ post: entry, subreddits });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    isGenerating = false;
  }
});

app.post('/api/generate-multiple', async (req, res) => {
  const count = Math.min(req.body.count || 3, 10);
  const results = [];

  for (let i = 0; i < count; i++) {
    try {
      const subreddits = await discoverRisingSubreddits();
      if (subreddits.length > 0) {
        const post = await generatePost(subreddits);
        if (post) {
          const entry = postQueue.add(post);
          results.push(entry);
        }
      }
    } catch (err) {
      console.error(`Generate batch #${i + 1} failed:`, err.message);
    }
  }

  res.json({ generated: results.length, posts: results });
});

app.post('/api/approve/:id', async (req, res) => {
  const { id } = req.params;
  const post = postQueue.approve(id);

  if (!post) {
    return res.status(404).json({ error: 'Post not found or already processed' });
  }

  try {
    const result = await submitPost(post.subreddit, post.title, post.content, post.type);
    if (result.success) {
      postQueue.markPosted(id, result);
      return res.json({ success: true, result });
    } else {
      postQueue.markFailed(id, result.error);
      return res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    postQueue.markFailed(id, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/approve-all', async (req, res) => {
  const pending = postQueue.getPending();
  const results = [];

  for (const post of pending) {
    postQueue.approve(post.id);
    try {
      const result = await submitPost(post.subreddit, post.title, post.content, post.type);
      if (result.success) {
        postQueue.markPosted(post.id, result);
        results.push({ id: post.id, success: true });
      } else {
        postQueue.markFailed(post.id, result.error);
        results.push({ id: post.id, success: false, error: result.error });
      }
    } catch (err) {
      postQueue.markFailed(post.id, err.message);
      results.push({ id: post.id, success: false, error: err.message });
    }
  }

  res.json({ processed: results.length, results });
});

app.post('/api/reject/:id', (req, res) => {
  const { id } = req.params;
  const post = postQueue.reject(id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

app.post('/api/auto-generate/start', (req, res) => {
  if (autoGenerateInterval) {
    return res.json({ running: true });
  }
  const interval = (req.body.intervalMinutes || 15) * 60 * 1000;

  autoGenerateInterval = setInterval(async () => {
    try {
      console.log('Auto-generating post...');
      const subreddits = await discoverRisingSubreddits();
      if (subreddits.length > 0) {
        const post = await generatePost(subreddits);
        if (post) {
          postQueue.add(post);
          console.log(`Auto-generated: r/${post.subreddit} - "${post.title}"`);
        }
      }
    } catch (err) {
      console.error('Auto-generate error:', err.message);
    }
  }, interval);

  res.json({ running: true, intervalMinutes: interval / 60000 });
});

app.post('/api/auto-generate/stop', (req, res) => {
  if (autoGenerateInterval) {
    clearInterval(autoGenerateInterval);
    autoGenerateInterval = null;
  }
  res.json({ running: false });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function init() {
  if (process.env.REDDIT_CLIENT_ID) {
    try {
      await loginToReddit();
      redditConnected = true;
    } catch (err) {
      console.error('OAuth login failed:', err.message);
      console.log('Run: node setup-oauth.js to create a Reddit app');
    }
  }

  app.listen(PORT, () => {
    console.log(`\n  🚀 Karma Farmer running at http://localhost:${PORT}\n`);
  });
}

process.on('SIGINT', async () => {
  if (autoGenerateInterval) clearInterval(autoGenerateInterval);
  await closeScraper();
  process.exit();
});

init();
