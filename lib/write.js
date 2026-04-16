import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getClient, joinText } from './anthropic.js';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT =
  'You are an expert blog writer specializing in political campaign strategy and marketing content. Write in the brand voice described in the messaging guide. Be practical, cite sources, and make every section actionable.';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUIDE_PATH = path.resolve(__dirname, '..', 'config', 'messaging-guide.txt');

let cachedGuide;

async function loadMessagingGuide() {
  if (cachedGuide !== undefined) return cachedGuide;
  try {
    cachedGuide = await fs.readFile(GUIDE_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      cachedGuide = '';
    } else {
      throw err;
    }
  }
  return cachedGuide;
}

function formatQuotes(quotes) {
  if (!quotes || quotes.length === 0) return '(none)';
  return quotes
    .map((q) => {
      if (typeof q === 'string') return `- "${q}"`;
      const speaker = q.speaker ? ` (${q.speaker})` : '';
      return `- "${q.quote}"${speaker}`;
    })
    .join('\n');
}

function formatList(items) {
  if (!items || items.length === 0) return '(none)';
  return items.map((item) => `- ${item}`).join('\n');
}

function buildUserPrompt({ extracted, researchNotes, messagingGuide }) {
  return [
    'MESSAGING GUIDE (brand voice, follow carefully):',
    messagingGuide ? messagingGuide : '(empty, use a clear and practical tone)',
    '',
    '=========================',
    '',
    `TOPIC: ${extracted.topic}`,
    '',
    'SUB-POINTS TO DEVELOP:',
    formatList(extracted.sub_points),
    '',
    'QUOTES FROM THE SOURCE TRANSCRIPT (use at least 2, attribute the speaker):',
    formatQuotes(extracted.quotes),
    '',
    'CLAIMS FROM THE SOURCE TRANSCRIPT:',
    formatList(extracted.statistics),
    '',
    'RESEARCH NOTES (use these as external data, cite the source inline):',
    researchNotes,
    '',
    '=========================',
    '',
    'TASK: Write a blog post of approximately 1700 words on the topic above.',
    '',
    'Formatting requirements:',
    '- Use H1 for the title.',
    '- Use H2 for each major section.',
    '- Use H3 or H4 for sub-sections as needed.',
    '- End with an FAQ section: one H2 titled "Frequently Asked Questions", then 5 to 7 questions each as an H3, with 2 to 4 sentence answers.',
    '',
    'Content requirements:',
    '- Follow the messaging guide voice.',
    '- Weave in the source quotes with speaker attribution.',
    '- Cite external stats inline, naming the source.',
    '- Every section should be practical and actionable.',
    '- Do not use em dashes anywhere. Use commas, periods, or parentheses instead.',
    '',
    'Output only the finished blog post in Markdown. No preamble.',
  ].join('\n');
}

export async function write({ extracted, researchNotes }) {
  const client = getClient();
  const messagingGuide = await loadMessagingGuide();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt({ extracted, researchNotes, messagingGuide }),
      },
    ],
  });

  const blogPost = joinText(response.content);
  if (!blogPost) {
    throw new Error('Write step returned no text content');
  }
  return blogPost;
}
