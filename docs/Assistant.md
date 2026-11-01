# Optional trail helper

The browser defaults to `assistant.endpoint: null`; opening its dialog does not
make a request. The server defaults disabled. `node assistant/server.mjs` binds
loopback port 8787 and exposes `/health` without contacting a provider.
No OpenAI calls/tests have been made.

The generic HTTP/origin/body/timeout and Responses/evidence-validation boundaries
are adapted from committed DecentBusking `agent-service/server.mjs` and
`model.mjs`, not its private handoff, wallet sign-in, deployment or routing pack.
The helper has only reviewed public V1 facts, no automatic chain reader, wallet,
location, journal, private handoff or conversation history.

## Review before enabling

Configure only server environment, never public files:

- `PILGRIMAGE_ASSISTANT_ENABLED=true` (otherwise disabled).
- `OPENAI_API_KEY` (server-held secret; never copied to a browser).
- `PILGRIMAGE_ASSISTANT_MODEL` (explicit reviewed provider model, no default).
- `PILGRIMAGE_ASSISTANT_ORIGINS` (comma-separated exact HTTPS origins; HTTP
  permitted only for localhost/127.0.0.1).
- Optional `PILGRIMAGE_ASSISTANT_TIMEOUT_MS` (default 8000, max 15000),
  `PILGRIMAGE_ASSISTANT_CONCURRENCY` (default 2, max 4),
  `PILGRIMAGE_ASSISTANT_MAX_CALLS` (default 100, max 1000, per process).

Use a reviewed HTTPS reverse proxy with its own persistent spend/rate controls.
The local request budget resets on restart and is not a durable accounting
system; production model activation requires steward/provider spend review.
Do not expose the repository or credentials via static hosting.

Only then set the browser endpoint to the actual reviewed HTTPS `/message`
URL in `public/scripts/v1/config.mjs`. Endpoint credentials/query/fragment are
rejected. Each request must be JSON containing **only**
`{ consent: true, message: THE_VISITOR_TYPED_TEXT }`. Consent resets after every
submission, including failure. Maximum message length is 1,200 characters and
request body 6 KB; context fields are rejected, not silently appended.

The server enforces exact origins, request concurrency, per-process request
budget, five requests/minute per ephemeral address, bounded rate map and request
timeouts. Upstream responses are capped at 64 KB and 800 output tokens. Displayed
answers are at most 2,400 characters and must validate approved public fact IDs.
Incomplete/unchecked/refused answers, transport failures and deadlines are
unavailable states, with no automatic retry or partial paid-success claim.
Provider requests set `store: false`; visitors must still avoid sensitive text.
The server does not log questions, credentials or upstream error bodies.

The helper is guidance, not an organizer, payroll steward, oracle or transaction
agent. It cannot determine bounty eligibility or approve a participant.

## Offline validation

`node --test test/ui/assistant.test.mjs` uses loopback servers and an injected
mock model transport only. It checks default disablement, missing config/key,
origins, consent, context rejection, size/output bounds, concurrency, timeout,
request budget and static-server isolation.
