import { extract } from './extract.js';
import { research } from './research.js';
import { write } from './write.js';
import { countWords, StepError } from '../../lib/utils.js';

export const code = 'MN';
export const name = 'Mary Noone Campaign Strategy';

export function validateInput(body) {
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  if (!transcript) {
    return { error: 'Missing "transcript" field for brand MN' };
  }
  return { input: { transcript } };
}

export async function runPipeline({ input, requestId, log = () => {} }) {
  const { transcript } = input;
  log(`[${requestId}] MN pipeline start, transcript length ${transcript.length}`);

  let extracted;
  try {
    log(`[${requestId}] step 1 extract`);
    extracted = await extract(transcript);
    log(`[${requestId}] extract ok, topic: ${extracted.topic}`);
  } catch (err) {
    throw new StepError('extract', err.message, err);
  }

  let researchNotes;
  try {
    log(`[${requestId}] step 2 research`);
    researchNotes = await research(extracted);
    log(`[${requestId}] research ok, ${researchNotes.length} chars`);
  } catch (err) {
    throw new StepError('research', err.message, err);
  }

  let blogPost;
  try {
    log(`[${requestId}] step 3 write`);
    blogPost = await write({ extracted, researchNotes });
    log(`[${requestId}] write ok, ${countWords(blogPost)} words`);
  } catch (err) {
    throw new StepError('write', err.message, err);
  }

  return {
    topic: extracted.topic,
    blogPost,
    wordCount: countWords(blogPost),
  };
}
