import { getClient, joinText } from '../../lib/anthropic.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;

const SYSTEM_PROMPT =
  'You are a research assistant. Output only in the exact format requested. No preamble, no summary, no extra commentary. Only provide verifiable data with named sources. If you cannot find a specific data point, skip it rather than guessing.';

function buildUserPrompt(extracted) {
  const subPointsText = (extracted.sub_points || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
  const statsText = (extracted.statistics || []).map((s) => `- ${s}`).join('\n');

  return [
    `Find 4 to 6 credible, recent data points that support a blog post on the topic: "${extracted.topic}".`,
    '',
    'Sub-points the post will develop:',
    subPointsText || '(none provided)',
    '',
    'Claims already made in the source transcript (for context only, do not repeat verbatim):',
    statsText || '(none provided)',
    '',
    'For each data point return this exact structure, with entries separated by a single blank line:',
    '',
    'STAT: <the specific statistic or finding>',
    'SOURCE: <publication or organization name, with URL if available>',
    'YEAR: <year of the data>',
    'RELEVANCE: <one sentence on why this matters for the topic>',
    '',
    'Skip any data point you cannot verify. Do not invent sources.',
  ].join('\n');
}

export async function research(extracted) {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(extracted) }],
  });

  const text = joinText(response.content);
  if (!text) {
    throw new Error('Research step returned no text content');
  }
  return text;
}
