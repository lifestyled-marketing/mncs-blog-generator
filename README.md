# MNCS Transcript to Blog Generator

A Vercel serverless function that receives a podcast transcript via webhook,
runs it through a three step Claude AI pipeline (extract, research, write), and
POSTs the finished blog post back to a Zapier Catch Hook URL.

## Endpoints

### `POST /api/generate-blog`

Request body:

```json
{
  "transcript": "full transcript text here",
  "callback_url": "https://hooks.zapier.com/hooks/catch/XXXXXX/YYYYYY/"
}
```

`callback_url` is optional. If omitted, the `ZAPIER_CALLBACK_URL` env var is
used.

The endpoint returns `202 Accepted` immediately so Zapier does not time out:

```json
{ "status": "accepted", "request_id": "abc12345", "message": "..." }
```

The pipeline runs in the background. When it finishes, the function POSTs the
result to the callback URL.

Success payload:

```json
{
  "status": "success",
  "topic": "The extracted topic",
  "blog_post": "# Full blog post in markdown...",
  "word_count": 1823,
  "generated_at": "2026-04-16T12:00:00Z"
}
```

Failure payload:

```json
{
  "status": "error",
  "error": "description of what failed",
  "failed_step": "extract | research | write"
}
```

### `GET /api/generate-blog`

Simple health check:

```json
{ "status": "ok" }
```

## Pipeline

1. **Extract** (`claude-opus-4-7`, 1500 tokens, no web search). Pulls
   the single most actionable topic, 3 to 5 quotes with speakers,
   statistics/claims, and 2 to 3 sub-points. Returns JSON.
2. **Research** (`claude-sonnet-4-20250514`, 1500 tokens, web search on with up
   to 5 uses of the `web_search_20250305` tool). Finds 4 to 6 credible data
   points supporting the topic, returned as `STAT / SOURCE / YEAR / RELEVANCE`
   blocks.
3. **Write** (`claude-opus-4-7`, 4096 tokens, no web search). Writes a
   roughly 1700 word blog post about the topic (the podcast is treated as a
   catalyst, not the subject), following `/config/messaging-guide.txt`, plus a
   5 to 7 question FAQ section. Swap the `MODEL` constant in `lib/write.js` to
   change models.

## Environment variables

Set these in the Vercel dashboard (Settings, Environment Variables):

- `ANTHROPIC_API_KEY`: Anthropic API key.
- `ZAPIER_CALLBACK_URL`: default Zapier Catch Hook URL. Overridden per request
  if the body includes a `callback_url`.

See `.env.example`.

## `vercel.json` max duration

`vercel.json` sets `maxDuration` to `300` seconds, which requires Vercel Pro.
If you are on the free plan, change it to `60`:

```json
{
  "functions": {
    "api/generate-blog.js": {
      "maxDuration": 60
    }
  }
}
```

## Messaging guide

`/config/messaging-guide.txt` is loaded by `lib/write.js` and passed to the
writer model as brand voice context. The file ships empty. Paste your guide
text in before going live.

## Local development

```bash
npm install
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY and ZAPIER_CALLBACK_URL
npx vercel dev
```

Test it locally:

```bash
curl -X POST http://localhost:3000/api/generate-blog \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Here is a short transcript..."}'
```

## Deploying to Vercel via GitHub

1. Create a new GitHub repo (for example `mncs-blog-generator`) and push this
   code to it.
2. Sign in at https://vercel.com and click **Add New, Project**.
3. Import the GitHub repo. Vercel auto-detects the `api/` directory and
   `vercel.json`.
4. Under **Environment Variables** add `ANTHROPIC_API_KEY` and
   `ZAPIER_CALLBACK_URL`.
5. Click **Deploy**. Your endpoint will be
   `https://<project>.vercel.app/api/generate-blog`.
6. Point the Zapier webhook action (or any upstream caller) at that URL.

## Notes

- The generator never uses em dashes in output. The writer system prompt
  enforces this.
- All three pipeline steps log to Vercel function logs with a shared
  `request_id` so a single run can be traced end to end.
- Keep the function dependency list minimal. Only `@anthropic-ai/sdk` is
  required.
