import Anthropic from '@anthropic-ai/sdk';

let client;

export function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function joinText(contentBlocks) {
  return contentBlocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}
