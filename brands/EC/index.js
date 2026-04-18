import { phase1Research } from './phase1-research.js';
import { phase2Gather } from './phase2-gather.js';
import { phase3Blueprint } from './phase3-blueprint.js';
import { phase4Draft } from './phase4-draft.js';
import { countWords, StepError } from '../../lib/utils.js';

export const code = 'EC';
export const name = 'Emberly Counseling';

export function validateInput(body) {
  const content = typeof body.content_start === 'string' ? body.content_start.trim() : '';
  if (!content) {
    return { error: 'Missing "content_start" field for brand EC (expects a topic or keyword)' };
  }
  return { input: { topic: content } };
}

export async function runPipeline({ input, requestId, log = () => {} }) {
  const { topic } = input;
  log(`[${requestId}] EC pipeline start, topic: ${topic}`);

  let phase1Output;
  try {
    log(`[${requestId}] phase 1 research`);
    phase1Output = await phase1Research(topic);
    log(`[${requestId}] phase 1 ok, ${phase1Output.length} chars`);
  } catch (err) {
    throw new StepError('phase1_research', err.message, err);
  }

  let phase2Output;
  try {
    log(`[${requestId}] phase 2 gather`);
    phase2Output = await phase2Gather({ topic, phase1Output });
    log(`[${requestId}] phase 2 ok, ${phase2Output.length} chars`);
  } catch (err) {
    throw new StepError('phase2_gather', err.message, err);
  }

  let blueprint;
  try {
    log(`[${requestId}] phase 3 blueprint`);
    blueprint = await phase3Blueprint({ topic, phase1Output, phase2Output });
    log(`[${requestId}] phase 3 ok, ${blueprint.length} chars`);
  } catch (err) {
    throw new StepError('phase3_blueprint', err.message, err);
  }

  let draftResult;
  try {
    log(`[${requestId}] phase 4 draft`);
    draftResult = await phase4Draft({ topic, blueprint });
    log(`[${requestId}] phase 4 ok, ${countWords(draftResult.draft)} words`);
  } catch (err) {
    throw new StepError('phase4_draft', err.message, err);
  }

  return {
    topic,
    blogPost: draftResult.draft,
    wordCount: countWords(draftResult.draft),
    metaTitle: draftResult.metaTitle,
    metaDescription: draftResult.metaDescription,
  };
}
