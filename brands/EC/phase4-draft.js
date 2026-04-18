import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getClient, joinText } from '../../lib/anthropic.js';
import { loadMessagingGuide, loadStyleGuide } from '../../lib/utils.js';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 6000;

const SYSTEM_PROMPT =
  'You are an expert blog writer for Emberly Counseling, a Pennsylvania therapy practice. Write warm, direct, evidence-based content that follows the brand voice guide exactly. Output only the finished blog draft in the exact format requested. No preamble.';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUIDE_PATH = path.resolve(__dirname, 'messaging-guide.txt');

let cachedGuide;
async function getGuide() {
  if (cachedGuide !== undefined) return cachedGuide;
  cachedGuide = await loadMessagingGuide(GUIDE_PATH);
  return cachedGuide;
}

function buildUserPrompt({ topic, blueprint, messagingGuide, styleGuide }) {
  return [
    'GLOBAL STYLE GUIDE (applies to every brand, non-negotiable):',
    styleGuide || '(none)',
    '',
    '=========================',
    '',
    'MESSAGING GUIDE (brand voice, follow exactly):',
    messagingGuide ? messagingGuide : '(empty, use plain direct American English at an 8th-grade reading level)',
    '',
    '=========================',
    '',
    `TOPIC: ${topic}`,
    '',
    'APPROVED BLUEPRINT (use this structure, titles, FAQ, keywords, and word budget):',
    blueprint,
    '',
    '=========================',
    '',
    'PHASE 4 - DRAFT',
    '',
    'Write the full blog post from the approved blueprint above.',
    '',
    'VOICE RULES (non-negotiable):',
    '- Match the messaging guide voice. If any rule in the blueprint conflicts with the messaging guide, the messaging guide wins.',
    '- No em dashes. Use commas, periods, or parentheses.',
    '- No "It is not X. It is Y." or "We do not just X. We Y." or "This is not about X. It is about Y." patterns.',
    '- No consultant-speak, no filler adjectives, no throat-clearing intros.',
    '- Short paragraphs (2 to 4 sentences). Active voice. Contractions are fine.',
    '- Informational and actionable. The reader should be able to do something after reading.',
    '',
    'STRUCTURE RULES:',
    '- Open with a hook that names the reader\'s actual problem in one or two sentences. No "In today\'s fast-paced world" setups.',
    '- Integrate keywords naturally. Never sacrifice a sentence for a keyword.',
    '- Use the heading structure from the blueprint exactly, unless a better order becomes obvious while writing. If you change the order, flag the change in your self-check.',
    '- Close with a clear next step, not a generic "in conclusion" wrap.',
    '- Include the FAQ section with schema-friendly Q and A formatting (H3 question, plain-paragraph answer).',
    '',
    'DELIVER, in this exact order, each under an H2 heading:',
    '',
    '## DRAFT',
    'The complete blog post draft in clean Markdown. H1 title, H2 sections, H3 sub-sections and FAQ questions. Include image placement suggestions inline as [IMAGE: description | alt: text] and internal/external link spots inline as [LINK: anchor text -> target].',
    '',
    '## META',
    'Final meta title (under 60 characters) on one line, then meta description (150 to 160 characters) on the next line.',
    '',
    '## SELF-CHECK',
    'A short checklist confirming: no em dashes, no banned patterns, keywords present, word count within target, FAQ included, any heading order changes flagged.',
  ].join('\n');
}

function splitDraftFromDeliverables(fullText) {
  const draftMatch = fullText.match(/##\s*DRAFT\s*([\s\S]*?)(?=\n##\s*META\b|$)/i);
  const metaMatch = fullText.match(/##\s*META\s*([\s\S]*?)(?=\n##\s*SELF-CHECK\b|$)/i);

  const draft = draftMatch ? draftMatch[1].trim() : fullText.trim();

  let metaTitle = '';
  let metaDescription = '';
  if (metaMatch) {
    const metaLines = metaMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (metaLines[0]) metaTitle = metaLines[0].replace(/^meta\s*title:\s*/i, '');
    if (metaLines[1]) metaDescription = metaLines[1].replace(/^meta\s*description:\s*/i, '');
  }

  return { draft, metaTitle, metaDescription };
}

export async function phase4Draft({ topic, blueprint }) {
  const client = getClient();
  const [messagingGuide, styleGuide] = await Promise.all([getGuide(), loadStyleGuide()]);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt({ topic, blueprint, messagingGuide, styleGuide }),
      },
    ],
  });

  const fullText = joinText(response.content);
  if (!fullText) {
    throw new Error('Phase 4 returned no text content');
  }

  const { draft, metaTitle, metaDescription } = splitDraftFromDeliverables(fullText);
  return { draft, metaTitle, metaDescription, fullText };
}
