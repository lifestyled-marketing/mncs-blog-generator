# MNCS Blog Generator

Vercel serverless function that generates brand-specific blog posts from a
webhook payload. Multiple brands, each with its own pipeline, prompts, and
messaging guide. The function returns `202 Accepted` immediately and POSTs
the finished blog post back to a Zapier Catch Hook URL.

## Endpoints

### `POST /api/generate-blog`

Every request uses the same two fields, regardless of brand:

- `brand_code` - two letter code (e.g. `MN`, `EC`)
- `content_start` - the input text for that brand. What it should contain
  depends on the brand (see below).

```json
{
  "brand_code": "MN",
  "content_start": "full podcast transcript text",
  "callback_url": "https://hooks.zapier.com/..."
}
```

```json
{
  "brand_code": "EC",
  "content_start": "How to tell the difference between OCD and anxiety",
  "callback_url": "https://hooks.zapier.com/..."
}
```

What `content_start` should contain, per brand:

- **MN**: a full podcast transcript.
- **EC**: a topic or keyword string (the thing you want the blog post to be
  about).

`callback_url` is optional. If omitted, the `ZAPIER_CALLBACK_URL` env var is
used.

The endpoint immediately returns:
```json
{ "status": "accepted", "request_id": "abc12345", "brand_code": "MN", "message": "..." }
```

### `GET /api/generate-blog`

Health check. Also lists supported brand codes:
```json
{ "status": "ok", "brands": ["MN", "EC"] }
```

## Callback payload

On success:
```json
{
  "status": "success",
  "brand_code": "MN",
  "topic": "The extracted topic",
  "blog_post": "{\\rtf1\\ansi... full RTF document ...}",
  "word_count": 1823,
  "meta_title": "under 60 chars (EC only)",
  "meta_description": "150 to 160 chars (EC only)",
  "generated_at": "2026-04-18T..."
}
```

`blog_post` is delivered as Rich Text Format (RTF), not Markdown. Save it as
`.rtf` or paste into Google Docs / Word and it renders with formatting intact
(headings, bold, italic, bullet and numbered lists, FAQ structure). Markdown
links render as `text (url)`. The pipeline writes Markdown internally; RTF
conversion happens in the router (`api/generate-blog.js`) right before the
callback POST, via `lib/markdown-to-rtf.js`. `word_count` is still measured on
the source Markdown.

On failure:
```json
{
  "status": "error",
  "brand_code": "MN",
  "error": "description of what failed",
  "failed_step": "extract | research | write | phase1_research | phase2_gather | phase3_blueprint | phase4_draft"
}
```

Zapier should branch on `brand_code` so the post goes to the right
destination.

## Global style guide

`style-guide.txt` at the repo root holds rules that apply to every brand's
writing steps, on top of each brand's messaging guide. Current rules:

- No "It's not X. It's Y." / "We don't just X. We Y." reframe patterns.
- No em dashes.

It gets loaded and injected into the user prompt for MN's write step, EC's
Phase 4 draft, and EC's Phase 5 framework check. Edit the file to add or
change rules. A brand's messaging guide defines voice and tone; the style
guide wins on anything it explicitly covers.

## Brands

### MN - Mary Noone Campaign Strategy

Input: `transcript`. A 3-step pipeline.

1. **Extract** (`claude-opus-4-7`, no web search) - pulls topic, 3 to 5
   quotes with speakers, stats/claims, and 2 to 3 sub-points from the
   transcript. Returns JSON.
2. **Research** (`claude-sonnet-4-6`, `web_search_20250305`) - 4 to 6 credible
   external data points with STAT / SOURCE / YEAR / RELEVANCE.
3. **Write** (`claude-opus-4-7`, no web search) - roughly 1700 word blog post
   about the topic (the podcast is only a catalyst, not the subject). H1
   title, H2 sections, FAQ at end. Follows `brands/MN/messaging-guide.txt`.

### EC - Emberly Counseling

Input: `topic`. A 5-phase pipeline.

1. **Phase 1 - Research** (`claude-sonnet-4-6`, `web_search_20250305`) -
   real search queries grouped by intent, top 5 ranking URLs, angles and
   gaps.
2. **Phase 2 - Source Gathering** (`claude-sonnet-4-6`,
   `web_fetch_20250910`) - pulls the top 3 to 5 URLs, produces a comparison
   table plus 3 to 5 content opportunities.
3. **Phase 3 - Blueprint** (`claude-opus-4-7`, no web) - recommended H1
   plus 9 alternates, meta description, URL slug, full outline with key
   points per section, FAQ seeds, keyword map, internal link opportunities,
   word budget.
4. **Phase 4 - Draft** (`claude-opus-4-7`, no web) - the full blog post
   written from the blueprint, plus meta title, meta description, inline
   image placements and link spots, and a self-check.
5. **Phase 5 - Framework Check** (`claude-opus-4-7`, no web) - verifies
   the draft against Emberly's core clinical frameworks (IFS, CBT, EMDR).
   Corrects any inaccuracies, misuse of framework terms, or
   non-trauma-informed advice. Preserves voice, structure, word count,
   image placements, and link spots. Review notes logged to Vercel but not
   returned in the callback.

Follows `brands/EC/messaging-guide.txt`.

## Environment variables

Set in the Vercel dashboard (Settings, Environment Variables):

- `ANTHROPIC_API_KEY` - Anthropic API key.
- `ZAPIER_CALLBACK_URL` - default Zapier Catch Hook URL. Overridden per
  request if the body includes a `callback_url`.

## Project structure

```
/api
  generate-blog.js            <- router, validates brand_code, 202 + waitUntil
/brands
  registry.js                 <- code -> brand module
  /MN
    index.js                  <- runPipeline, validateInput
    extract.js, research.js, write.js
    messaging-guide.txt
  /EC
    index.js
    phase1-research.js, phase2-gather.js, phase3-blueprint.js, phase4-draft.js
    messaging-guide.txt
/lib
  anthropic.js                <- shared SDK client
  utils.js                    <- countWords, loadMessagingGuide, StepError
vercel.json, package.json, .env.example, .gitignore
```

### Adding a new brand

1. `mkdir brands/XX`
2. Add `brands/XX/messaging-guide.txt`.
3. Add a module `brands/XX/index.js` that exports:
   - `code: "XX"`
   - `name: "Full Brand Name"`
   - `validateInput(body)` - reads `body.content_start`, returns
     `{ input }` or `{ error }`. `input` is whatever shape the brand's
     `runPipeline` expects (for example `{ transcript }` or `{ topic }`).
   - `runPipeline({ input, requestId, log })` - returns
     `{ topic, blogPost, wordCount, metaTitle?, metaDescription? }`.
4. Register it in `brands/registry.js`: `import * as XX from './XX/index.js'`
   and add `XX` to the `brands` object.

## `vercel.json` max duration

Set to `800` seconds, the max for Vercel Pro with Fluid Compute (enabled by
default for new projects). EC's 5-phase pipeline with `web_search` and
`web_fetch` can run 4 to 6 minutes end to end, so 300s is not enough. On the
Hobby plan, the max is `60`, which is not enough for either brand.

```json
{ "functions": { "api/generate-blog.js": { "maxDuration": 800 } } }
```

## Local development

```bash
npm install
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY and ZAPIER_CALLBACK_URL
npx vercel dev
```

Test MN locally:
```bash
curl -X POST http://localhost:3000/api/generate-blog \
  -H "Content-Type: application/json" \
  -d '{"brand_code":"MN","content_start":"Short test transcript..."}'
```

Test EC locally:
```bash
curl -X POST http://localhost:3000/api/generate-blog \
  -H "Content-Type: application/json" \
  -d '{"brand_code":"EC","content_start":"How to tell OCD from anxiety"}'
```

## Notes

- The generator never uses em dashes in output. Both writer prompts enforce
  this.
- All steps log to Vercel function logs with a shared `request_id` so a
  single run can be traced end to end.
- Pipeline runs in the background via `@vercel/functions` `waitUntil`, up to
  the function's `maxDuration`.
