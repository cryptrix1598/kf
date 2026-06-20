import dotenv from 'dotenv';
dotenv.config();

const USER_AGENT = 'KarmaFarmer/1.0 by InvestigatorDull9853';
let accessToken = null;
let tokenExpiry = 0;

export async function loginToReddit() {
  const { REDDIT_USERNAME, REDDIT_PASSWORD, REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET } = process.env;

  if (!REDDIT_USERNAME || !REDDIT_PASSWORD) {
    throw new Error('REDDIT_USERNAME and REDDIT_PASSWORD must be set in .env');
  }

  if (!REDDIT_CLIENT_ID) {
    throw new Error('REDDIT_CLIENT_ID not set. Run: node setup-oauth.js');
  }

  const auth = REDDIT_CLIENT_SECRET
    ? Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')
    : Buffer.from(`${REDDIT_CLIENT_ID}:`).toString('base64');

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: REDDIT_USERNAME,
      password: REDDIT_PASSWORD,
    }),
  });

  const data = await res.json();

  if (!data.access_token) {
    throw new Error(`OAuth failed: ${data.error || JSON.stringify(data)}. Check REDDIT_CLIENT_ID is correct.`);
  }

  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  console.log('Logged into Reddit via OAuth');
}

async function ensureToken() {
  if (!accessToken || Date.now() > tokenExpiry) {
    await loginToReddit();
  }
}

export async function submitPost(subreddit, title, content, type = 'text') {
  await ensureToken();

  const params = {
    api_type: 'json',
    kind: type === 'link' ? 'link' : 'self',
    sr: subreddit,
    title: title,
  };

  if (type === 'text' && content) {
    params.text = content;
  } else if (type === 'link' && content) {
    params.url = content;
  }

  try {
    const res = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams(params),
    });

    const data = await res.json();

    if (data?.json?.errors?.length > 0) {
      const errMsg = data.json.errors.map(e => e[1] || e[0]).join(', ');
      return { success: false, error: errMsg, title, subreddit };
    }

    console.log(`Posted to r/${subreddit}: "${title}"`);
    return { success: true, title, subreddit };
  } catch (err) {
    return { success: false, error: err.message, title, subreddit };
  }
}
