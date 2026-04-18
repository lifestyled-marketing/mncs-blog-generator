import { getClient, joinText } from '../../lib/anthropic.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2500;

const SYSTEM_PROMPT =
  'You are an SEO content strategist doing discovery research. Use web_search to gather real search intent, ranking articles, and recent shifts. Output only in the exact format requested. No preamble.';

function buildUserPrompt(topic) {
  return [
    `TOPIC: ${topic}`,
    '',
    'PHASE 1 - RESEARCH',
    '',
    'Use web_search to surface:',
    `1. Real questions people ask about this topic. Try search variations like "${topic} questions", "how to ${topic}", "${topic} vs", "why ${topic}", "${topic} reddit".`,
    '2. The top 5 ranking articles for the main keyword and 2 to 3 close variants.',
    '3. Any recent news, data, or shifts in the topic from the last 12 months.',
    '',
    'Return, in this order and nothing else:',
    '',
    '## SEARCH QUERIES',
    'Group 10 to 15 real search queries by intent. Use these 4 subheadings: Informational, Comparison, How-to, Problem-solving. Put each query on its own bullet line.',
    '',
    '## TOP RANKING URLS',
    'List the top 5 ranking URLs. For each, write one line: "URL, one-line note on what it is".',
    '',
    '## ANGLES AND GAPS',
    'A short list of angles or gaps: topics that are over-covered, questions no one is answering well, outdated info.',
  ].join('\n');
}

export async function phase1Research(topic) {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 8,
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(topic) }],
  });

  const text = joinText(response.content);
  if (!text) {
    throw new Error('Phase 1 returned no text content');
  }
  return text;
}
