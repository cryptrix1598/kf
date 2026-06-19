import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const client = new OpenAI({
  baseURL: process.env.NVIDIA_BASE_URL,
  apiKey: process.env.NVIDIA_API_KEY,
});

export async function generatePost(subreddits, trendingTopics) {
  const subredditsText = subreddits.map(s => `r/${s.name} — trending post: "${s.trendingPost}"`).join('\n');

  const prompt = `You are a Reddit growth strategist. Your job is to generate high-karma potential posts.

Today's rising subreddits and what's trending:
${subredditsText}

Pick the BEST subreddit for maximum karma and generate a post for it.

Rules:
- The post must be original, high-effort, and valuable to the community
- Match the subreddit's tone and style
- Use a clickable but not spammy title
- No low-effort reposts or copy-paste
- The content must feel authentic and human

Respond with ONLY valid JSON (no markdown, no backticks):
{
  "subreddit": "chosen subreddit name",
  "title": "post title",
  "content": "post content / body text",
  "type": "text" | "link",
  "reasoning": "why this will get karma"
}`;

  const completion = await client.chat.completions.create({
    model: process.env.NVIDIA_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 1,
    top_p: 1,
    max_tokens: 16384,
    stream: false,
  });

  const raw = completion.choices[0]?.message?.content || '';
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.subreddit && parsed.subreddit.startsWith('r/')) {
      parsed.subreddit = parsed.subreddit.slice(2);
    }
    return parsed;
  } catch {
    console.error('AI returned invalid JSON:', raw);
    return null;
  }
}

export async function generateReply(context) {
  const prompt = `You are replying to a Reddit comment to gain karma. Write a valuable, engaging reply.

Context:
${context}

Reply naturally, be helpful or funny, and keep it concise (1-3 sentences). Return ONLY the reply text.`;

  const completion = await client.chat.completions.create({
    model: process.env.NVIDIA_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.9,
    top_p: 1,
    max_tokens: 1024,
    stream: false,
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}
