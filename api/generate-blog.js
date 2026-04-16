import { extract } from '../lib/extract.js';
import { research } from '../lib/research.js';
import { write } from '../lib/write.js';

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function postCallback(callbackUrl, payload) {
  try {
    const res = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[callback] non-2xx ${res.status}: ${body.slice(0, 300)}`);
    } else {
      console.log(`[callback] delivered ${res.status}`);
    }
  } catch (err) {
    console.error('[callback] network error:', err);
  }
}

async function runPipeline({ transcript, callbackUrl, requestId }) {
  console.log(`[${requestId}] pipeline start, transcript length ${transcript.length}`);
  let failedStep = null;
  try {
    failedStep = 'extract';
    console.log(`[${requestId}] step 1 extract`);
    const extracted = await extract(transcript);
    console.log(`[${requestId}] extract ok, topic: ${extracted.topic}`);

    failedStep = 'research';
    console.log(`[${requestId}] step 2 research`);
    const researchNotes = await research(extracted);
    console.log(`[${requestId}] research ok, ${researchNotes.length} chars`);

    failedStep = 'write';
    console.log(`[${requestId}] step 3 write`);
    const blogPost = await write({ extracted, researchNotes });
    const wordCount = countWords(blogPost);
    console.log(`[${requestId}] write ok, ${wordCount} words`);

    await postCallback(callbackUrl, {
      status: 'success',
      topic: extracted.topic,
      blog_post: blogPost,
      word_count: wordCount,
      generated_at: new Date().toISOString(),
    });
    console.log(`[${requestId}] pipeline done`);
  } catch (err) {
    console.error(`[${requestId}] pipeline failed at ${failedStep}:`, err);
    await postCallback(callbackUrl, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      failed_step: failedStep,
    });
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length > 0) {
    return JSON.parse(req.body);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ status: 'ok' });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ status: 'error', error: 'Method not allowed' });
    return;
  }

  const requestId = Math.random().toString(36).slice(2, 10);

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    console.error(`[${requestId}] invalid JSON body:`, err);
    res.status(400).json({ status: 'error', error: 'Invalid JSON body' });
    return;
  }

  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  if (!transcript) {
    res.status(400).json({ status: 'error', error: 'Missing "transcript" in request body' });
    return;
  }

  const callbackUrl = body.callback_url || process.env.ZAPIER_CALLBACK_URL;
  if (!callbackUrl) {
    res.status(400).json({
      status: 'error',
      error: 'No callback_url provided and ZAPIER_CALLBACK_URL env var is not set',
    });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ status: 'error', error: 'ANTHROPIC_API_KEY is not set' });
    return;
  }

  const pipelinePromise = runPipeline({ transcript, callbackUrl, requestId });

  // Vercel's @vercel/functions waitUntil would be ideal here, but to keep deps
  // minimal we rely on the Node runtime continuing to run the promise after
  // the response is flushed, up to the function's maxDuration in vercel.json.
  if (typeof globalThis.waitUntil === 'function') {
    globalThis.waitUntil(pipelinePromise);
  }

  res.status(202).json({
    status: 'accepted',
    request_id: requestId,
    message: 'Blog generation started. Results will be POSTed to the callback URL.',
  });

  // Keep a reference so lint does not flag the floating promise.
  await pipelinePromise.catch(() => {});
}
