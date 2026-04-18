import { getClient, joinText } from '../../lib/anthropic.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 3000;

const SYSTEM_PROMPT =
  'You are an SEO content analyst. Use web_fetch to pull full articles and compare them. Output only in the exact format requested. No preamble.';

function buildUserPrompt({ topic, phase1Output }) {
  return [
    `TOPIC: ${topic}`,
    '',
    'PHASE 1 OUTPUT (use the TOP RANKING URLS section as your targets):',
    phase1Output,
    '',
    '=========================',
    '',
    'PHASE 2 - SOURCE GATHERING',
    '',
    'Use web_fetch on the top 3 to 5 ranking URLs from Phase 1.',
    '',
    'For each article, pull:',
    '- Full heading structure (H1, H2, H3)',
    '- Word count estimate',
    '- Main claims, stats, and data points',
    '- Unique angles or framing',
    '- What is missing or weak',
    '',
    'Return, in this order and nothing else:',
    '',
    '## COMPARISON TABLE',
    'A Markdown table with columns: URL | Word count | Heading structure summary | Key points covered | Gaps.',
    '',
    '## CONTENT OPPORTUNITIES',
    'Below the table, list 3 to 5 content opportunities no one else is hitting well.',
  ].join('\n');
}

export async function phase2Gather({ topic, phase1Output }) {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: 'web_fetch_20250910',
        name: 'web_fetch',
        max_uses: 5,
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt({ topic, phase1Output }) }],
  });

  const text = joinText(response.content);
  if (!text) {
    throw new Error('Phase 2 returned no text content');
  }
  return text;
}
