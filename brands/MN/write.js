import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getClient, joinText } from '../../lib/anthropic.js';
import { loadMessagingGuide, loadStyleGuide } from '../../lib/utils.js';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT =
  'You are an expert blog writer specializing in political campaign strategy and marketing content. Write in the brand voice described in the messaging guide. Be practical, cite sources, and make every section actionable.';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUIDE_PATH = path.resolve(__dirname, 'messaging-guide.txt');

let cachedGuide;
async function getGuide() {
  if (cachedGuide !== undefined) return cachedGuide;
  cachedGuide = await loadMessagingGuide(GUIDE_PATH);
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

function buildUserPrompt({ extracted, researchNotes, messagingGuide, styleGuide }) {
  return [
    'GLOBAL STYLE GUIDE (applies to every brand, non-negotiable):',
    styleGuide || '(none)',
    '',
    '=========================',
    '',
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
    'SUPPORTING QUOTES FROM THE PODCAST (use at most 1 to 2 total, attribute the speaker):',
    formatQuotes(extracted.quotes),
    '',
    'CLAIMS MADE ON THE PODCAST (use as supporting data points where relevant):',
    formatList(extracted.statistics),
    '',
    'RESEARCH NOTES (external, verified data, cite the source inline):',
    researchNotes,
    '',
    '=========================',
    '',
    'TASK: Write a blog post of approximately 1700 words on the TOPIC above.',
    '',
    'CRITICAL FRAMING RULES (read carefully):',
    '- The blog post is about the TOPIC. It is NOT about the podcast episode, the show, or the guest.',
    '- The podcast is the catalyst for the post, not its subject. Do not summarize the episode, recap the conversation, or center the guest.',
    '- Do not reference the podcast, the host, or the guest in the title, headers, intro, or conclusion.',
    '- Treat the podcast material like any other source: pull in at most 1 to 2 short supporting quotes and any relevant stats or claims, and cite them inline with the speaker\'s name the first time they appear (for example, "as Jane Smith noted on the podcast").',
    '- The majority of the post should be evergreen topic content supported by the external research notes. A reader who has never heard of the podcast should not feel they are missing context.',
    '',
    'Formatting requirements:',
    '- Use H1 for the title. The title must be about the topic, not the episode or the guest.',
    '- Use H2 for each major section.',
    '- Use H3 or H4 for sub-sections as needed.',
    '- End with an FAQ section: one H2 titled "Frequently Asked Questions", then 5 to 7 questions each as an H3, with 2 to 4 sentence answers. The FAQ should answer questions a reader would ask about the topic, not about the podcast.',
    '',
    'Content requirements:',
    '- Follow the messaging guide voice.',
    '- Lead with the topic and why it matters. Do not open by mentioning the podcast.',
    '- Cite external stats inline, naming the source.',
    '- Every section should be practical and actionable.',
    '- Do not use em dashes anywhere. Use commas, periods, or parentheses instead.',
    '',
    'Output only the finished blog post in Markdown. No preamble.',
  ].join('\n');
}

export async function write({ extracted, researchNotes }) {
  const client = getClient();
  const [messagingGuide, styleGuide] = await Promise.all([getGuide(), loadStyleGuide()]);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt({ extracted, researchNotes, messagingGuide, styleGuide }),
      },
    ],
  });

  const blogPost = joinText(response.content);
  if (!blogPost) {
    throw new Error('Write step returned no text content');
  }
  return blogPost;
}
