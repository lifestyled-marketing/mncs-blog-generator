import { getClient, joinText } from './anthropic.js';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 1500;

const SYSTEM_PROMPT =
  'You are a content extraction assistant. Output only valid JSON. No explanation, no markdown formatting.';

function buildUserPrompt(transcript) {
  return [
    'Read the following podcast transcript and extract material for a blog post.',
    '',
    'Return a JSON object with exactly these keys:',
    '- topic: a string naming the single most practical, actionable blog topic in the transcript',
    '- quotes: an array of 3 to 5 direct quotes, each with fields "quote" and "speaker"',
    '- statistics: an array of statistics, data points, or specific claims made in the transcript (strings)',
    '- sub_points: an array of 2 to 3 sub-points to develop in the blog post (strings)',
    '',
    'Output ONLY the JSON object. No prose, no code fences.',
    '',
    'TRANSCRIPT:',
    transcript,
  ].join('\n');
}

function stripCodeFences(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return trimmed;
}

export async function extract(transcript) {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(transcript) }],
  });

  const raw = stripCodeFences(joinText(response.content));

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Extract step returned invalid JSON: ${err.message}. Raw output: ${raw.slice(0, 500)}`);
  }

  if (!parsed.topic || typeof parsed.topic !== 'string') {
    throw new Error('Extract step output is missing a valid "topic" field');
  }

  return {
    topic: parsed.topic,
    quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
    statistics: Array.isArray(parsed.statistics) ? parsed.statistics : [],
    sub_points: Array.isArray(parsed.sub_points) ? parsed.sub_points : [],
  };
}
