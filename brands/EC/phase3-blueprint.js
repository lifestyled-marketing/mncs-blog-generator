import { getClient, joinText } from '../../lib/anthropic.js';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 3500;

const SYSTEM_PROMPT =
  'You are an SEO content strategist building a blog blueprint. Organize for reader flow, not keyword stuffing. Output only in the exact format requested. No preamble.';

function buildUserPrompt({ topic, phase1Output, phase2Output }) {
  return [
    `TOPIC: ${topic}`,
    '',
    'PHASE 1 RESEARCH (search queries, ranking URLs, angles and gaps):',
    phase1Output,
    '',
    '=========================',
    '',
    'PHASE 2 SOURCE ANALYSIS (comparison of competitors, content opportunities):',
    phase2Output,
    '',
    '=========================',
    '',
    'PHASE 3 - BLUEPRINT',
    '',
    'Produce the following sections, each with its own H2 heading, in this exact order:',
    '',
    '## RECOMMENDED H1',
    'The recommended H1. Then 9 alternate title options. Keyword-forward, specific, promise-driven. Avoid clickbait that overpromises.',
    '',
    '## META DESCRIPTION',
    'A meta description of 150 to 160 characters.',
    '',
    '## URL SLUG',
    'A suggested URL slug.',
    '',
    '## OUTLINE',
    'A full outline using H1, H2s, and H3s organized for reader flow, not search stuffing. Under each H2 include 2 to 4 key points to cover.',
    '',
    '## FAQ',
    'A FAQ section with 5 to 8 real questions pulled from the Phase 1 research.',
    '',
    '## KEYWORDS',
    'Primary keyword plus 3 to 5 secondary keywords. For each, note where it should appear (title, H1, H2, intro, body, FAQ, meta, etc.).',
    '',
    '## INTERNAL LINK OPPORTUNITIES',
    'Places where a link to related content would help the reader. Note the anchor text and the kind of target page.',
    '',
    '## WORD BUDGET',
    'Target word count and a rough word budget per section.',
  ].join('\n');
}

export async function phase3Blueprint({ topic, phase1Output, phase2Output }) {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt({ topic, phase1Output, phase2Output }) }],
  });

  const text = joinText(response.content);
  if (!text) {
    throw new Error('Phase 3 returned no text content');
  }
  return text;
}
