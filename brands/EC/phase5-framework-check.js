import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getClient, joinText } from '../../lib/anthropic.js';
import { loadMessagingGuide, loadStyleGuide } from '../../lib/utils.js';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 7000;

const SYSTEM_PROMPT =
  'You are a licensed clinical reviewer with deep working knowledge of Internal Family Systems (IFS), Cognitive Behavioral Therapy (CBT), and Eye Movement Desensitization and Reprocessing (EMDR). Your job is to verify that a blog post accurately represents these frameworks and to correct inaccuracies. You do not rewrite for style. You do not make content more clinical. You preserve the author\'s voice exactly. Output only in the exact format requested. No preamble.';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUIDE_PATH = path.resolve(__dirname, 'messaging-guide.txt');

let cachedGuide;
async function getGuide() {
  if (cachedGuide !== undefined) return cachedGuide;
  cachedGuide = await loadMessagingGuide(GUIDE_PATH);
  return cachedGuide;
}

function buildUserPrompt({ topic, draft, messagingGuide, styleGuide }) {
  return [
    'GLOBAL STYLE GUIDE (applies to every brand, non-negotiable):',
    styleGuide || '(none)',
    '',
    '=========================',
    '',
    'MESSAGING GUIDE (brand voice, MUST be preserved):',
    messagingGuide ? messagingGuide : '(empty, preserve the voice already present in the draft)',
    '',
    '=========================',
    '',
    `TOPIC: ${topic}`,
    '',
    'DRAFT TO REVIEW:',
    draft,
    '',
    '=========================',
    '',
    'PHASE 5 - FRAMEWORK CHECK',
    '',
    'Emberly Counseling\'s practice is built on three core therapeutic frameworks:',
    '- Internal Family Systems (IFS): parts language, Self energy, unburdening, no part is "bad"',
    '- Cognitive Behavioral Therapy (CBT): thoughts -> feelings -> behaviors, cognitive distortions, exposure and response prevention for OCD, behavioral experiments',
    '- Eye Movement Desensitization and Reprocessing (EMDR): the 8 phases, adaptive information processing model, bilateral stimulation, safety and pacing',
    '',
    'YOUR JOB:',
    'Read the draft carefully. Flag and fix anything that:',
    '1. Misrepresents IFS, CBT, or EMDR (for example: calling a part "the bad part", describing EMDR as hypnosis, describing CBT as "just thinking positive", conflating frameworks incorrectly).',
    '2. Makes claims about outcomes, timelines, or mechanisms that are not supported by the actual frameworks.',
    '3. Uses framework terms incorrectly or in a way that would mislead a reader who might seek therapy.',
    '4. Gives advice that contradicts trauma-informed, evidence-based practice (for example: pushing someone to "just face the trauma", promising cures, minimizing pacing).',
    '',
    'WHAT NOT TO DO:',
    '- Do NOT make the writing more clinical, technical, or jargon-heavy.',
    '- Do NOT rewrite for style, flow, or SEO.',
    '- Do NOT change the heading structure, word count, FAQ questions, image placements, or link spots unless a specific item is factually wrong.',
    '- Do NOT add new framework references where none were needed. If the post does not need to name IFS, CBT, or EMDR, leave it alone.',
    '- Do NOT remove warmth, plain language, or the messaging guide voice. The voice wins every time.',
    '- Do NOT use em dashes anywhere. Use commas, periods, or parentheses.',
    '',
    'If a sentence is already correct, leave it exactly as written. Touch as little as possible.',
    '',
    'DELIVER, in this exact order, each under an H2 heading:',
    '',
    '## REVISED DRAFT',
    'The complete blog post in clean Markdown, with inaccuracies corrected and everything else identical to the original. Keep all H1 / H2 / H3 headings, FAQ, [IMAGE: ...] placements, and [LINK: ...] spots from the original draft unless a specific item had to change for accuracy.',
    '',
    '## FRAMEWORK REVIEW NOTES',
    'A short bulleted list of the specific changes you made and why (framework name + the issue). If you made no changes, say "No changes needed" and briefly note what you verified.',
  ].join('\n');
}

function splitRevisedDraft(fullText) {
  const draftMatch = fullText.match(/##\s*REVISED DRAFT\s*([\s\S]*?)(?=\n##\s*FRAMEWORK REVIEW NOTES\b|$)/i);
  const notesMatch = fullText.match(/##\s*FRAMEWORK REVIEW NOTES\s*([\s\S]*?)$/i);

  const revisedDraft = draftMatch ? draftMatch[1].trim() : fullText.trim();
  const reviewNotes = notesMatch ? notesMatch[1].trim() : '';

  return { revisedDraft, reviewNotes };
}

export async function phase5FrameworkCheck({ topic, draft }) {
  const client = getClient();
  const [messagingGuide, styleGuide] = await Promise.all([getGuide(), loadStyleGuide()]);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt({ topic, draft, messagingGuide, styleGuide }),
      },
    ],
  });

  const fullText = joinText(response.content);
  if (!fullText) {
    throw new Error('Phase 5 returned no text content');
  }

  const { revisedDraft, reviewNotes } = splitRevisedDraft(fullText);
  return { revisedDraft, reviewNotes };
}
