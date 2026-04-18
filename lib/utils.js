import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STYLE_GUIDE_PATH = path.resolve(__dirname, '..', 'style-guide.txt');

let cachedStyleGuide;
export async function loadStyleGuide() {
  if (cachedStyleGuide !== undefined) return cachedStyleGuide;
  cachedStyleGuide = await loadMessagingGuide(STYLE_GUIDE_PATH);
  return cachedStyleGuide;
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
