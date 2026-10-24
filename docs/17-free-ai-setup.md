# Free AI coaching

25 October 2026. No provider purchase is required or implemented. The app cannot verify a Groq account's billing plan; keep the account on Free. Provider availability and limits can change.

## Try without setup

The default `MODEL_PROVIDER=mock` now runs guided practice. The exact Campus Tickets fixture has a source-linked checklist that handles weak answers, the stale-price error, correct reasoning, trade-offs and missing context. Own projects get communication-structure coaching, with technical correctness explicitly unassessed. This is useful offline practice, not general AI understanding.

## Groq Free: quickest hosted option

Create a key in the [Groq console](https://console.groq.com/keys). The [billing FAQ](https://console.groq.com/docs/billing-faqs) describes Free access; [rate limits](https://console.groq.com/docs/rate-limits) depend on the model/account. This adapter uses strict [structured outputs](https://console.groq.com/docs/structured-outputs).

Put these settings in the gitignored `.env.local`, replacing the placeholder only on your computer:

```dotenv
MODEL_PROVIDER=groq
MODEL_NAME=openai/gpt-oss-20b
GROQ_API_KEY=your_free_account_key
MODEL_FREE_TIER_ONLY=true
MODEL_DAILY_REQUEST_LIMIT=120
MODEL_SESSION_REQUEST_LIMIT=24
PROVIDER_TIMEOUT_SECONDS=45
```

Restart web and worker, then create a fresh project. The consent screen discloses that selected source excerpts and answers are sent to Groq. The app uses the official Groq endpoint only; it cannot upgrade an account and never switches to a paid provider. A rate limit saves the answer and exposes retry/end controls. Do not repeatedly retry an exhausted daily allowance.

## Ollama: local open-weight models

Install [Ollama for Windows](https://ollama.com/download/windows), then download a local instruction model suitable for your machine. `ollama list` shows exact installed names. Use a model supporting reliable JSON generation; the adapter supplies Ollama's [structured-output schema](https://docs.ollama.com/capabilities/structured-outputs). A small model reduces memory demand but needs careful quality testing. Model licenses vary.

```dotenv
MODEL_PROVIDER=ollama
MODEL_BASE_URL=http://127.0.0.1:11434
MODEL_NAME=your_installed_local_model
MODEL_DAILY_REQUEST_LIMIT=120
MODEL_SESSION_REQUEST_LIMIT=24
PROVIDER_TIMEOUT_SECONDS=90
```

Restart web and worker, then prepare a fresh project. The initial context window is 8192 tokens. Only loopback HTTP is accepted, redirects are disabled, and cloud-named models are rejected. The configured Ollama server must itself be operated in local mode. Generation can be slower on CPU or when VRAM is constrained. There is no per-request hosted API charge; local electricity/hardware costs still exist.

## How coaching and limits work

Preparation makes one structured request using a file/symbol map and up to six complete source excerpts. Each answer makes one coaching request with retrieved source, the question and prior coaching. Feedback names strengths, gaps, concrete improvements and an optional illustrative answer. A weak answer can trigger at most two follow-ups per topic. The report summarizes saved coaching without another model call. Explicit End can always bypass unfinished coaching and mark that answer unassessed.

All attempts reserve a shared daily request and an entity allowance atomically in PostgreSQL. Preparation and each session have separate entity allowances. Defaults are 120/day and 24/entity; failures and retries count. Request/response size and timeouts are bounded. There is no streaming claim: durable asynchronous generation shows an honest busy state, then publishes complete validated feedback. Provider/model provenance is frozen in the plan; changing providers requires a fresh project rather than silently switching an existing interview.

## Verify before trusting it

Try a concise correct answer, a confident wrong answer, an admission that you do not know, and a correction after coaching. Open the source links and check whether the explanation follows from the excerpt. Ask about a file not in the reviewed pack and check that uncertainty is acknowledged. Saved assisted revisions are labelled; a polished answer after seeing an example does not prove unaided improvement.

The local automated suite covers transport contracts and no-fallback behaviour using synthetic responses. Real Groq/Ollama quality, latency, local hardware suitability and microphone behaviour still require hands-on evaluation. Gemini's [free tier](https://ai.google.dev/gemini-api/docs/pricing) is another possible service, but its free data-use terms need review and no Gemini adapter is implemented in this build.
