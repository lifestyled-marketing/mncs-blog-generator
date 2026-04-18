import { waitUntil } from '@vercel/functions';
import { getBrand, listBrandCodes } from '../brands/registry.js';

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

async function runBrandPipeline({ brand, input, callbackUrl, requestId }) {
  const brandCode = brand.code;
  try {
    const result = await brand.runPipeline({
      input,
      requestId,
      log: (...args) => console.log(...args),
    });

    await postCallback(callbackUrl, {
      status: 'success',
      brand_code: brandCode,
      topic: result.topic,
      blog_post: result.blogPost,
      word_count: result.wordCount,
      meta_title: result.metaTitle || null,
      meta_description: result.metaDescription || null,
      generated_at: new Date().toISOString(),
    });
    console.log(`[${requestId}] pipeline done`);
  } catch (err) {
    const failedStep = err && err.step ? err.step : 'unknown';
    console.error(`[${requestId}] pipeline failed at ${failedStep}:`, err);
    await postCallback(callbackUrl, {
      status: 'error',
      brand_code: brandCode,
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
    res.status(200).json({ status: 'ok', brands: listBrandCodes() });
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

  const brand = getBrand(body.brand_code);
  if (!brand) {
    res.status(400).json({
      status: 'error',
      error: `Unknown or missing "brand_code". Supported codes: ${listBrandCodes().join(', ')}`,
    });
    return;
  }

  const validation = brand.validateInput(body);
  if (validation.error) {
    res.status(400).json({ status: 'error', error: validation.error });
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

  waitUntil(
    runBrandPipeline({
      brand,
      input: validation.input,
      callbackUrl,
      requestId,
    }),
  );

  res.status(202).json({
    status: 'accepted',
    request_id: requestId,
    brand_code: brand.code,
    message: 'Blog generation started. Results will be POSTed to the callback URL.',
  });
}
