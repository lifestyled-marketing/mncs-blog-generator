import fs from 'node:fs/promises';

export function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function loadMessagingGuide(absolutePath) {
  try {
    return await fs.readFile(absolutePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

export function stripCodeFences(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return trimmed;
}

export class StepError extends Error {
  constructor(step, message, cause) {
    super(message);
    this.step = step;
    if (cause) this.cause = cause;
  }
}
