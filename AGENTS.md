# Project Name

SvelteKit (Svelte 5 runes) app with native CSS that turns uploaded vlog footage into an
AI-edited first cut. The server uses FFmpeg for audio extraction, contact sheets,
trimming, normalization, and assembly; Whisper creates segment-level timestamped transcripts; and GPT-5.6 Terra reviews
all transcripts and timestamped contact sheets, then uses a sandboxed Bash tool to
run FFmpeg and produce the final movie.

## Commands

- `npm run dev` — dev server (see **Dev** note about ports)
- `npm run build` — production build
- `npm run preview` — preview the build
- `npm run lint` — Prettier check + ESLint
- `npm run format` — Prettier write

## Tech Stack

SvelteKit 2 + Svelte 5 (runes), native component-scoped CSS, Vite 5, `@sveltejs/adapter-auto`,
Zod validation, OpenAI Node SDK, and system FFmpeg/FFprobe binaries.

## Env Variables (.env)

Set either `OPENAI_API_KEY` or `LLM_API_KEY`. OpenRouter keys are detected by their
`sk-or-` prefix. Optional overrides: `LLM_BASE_URL`, `TRANSCRIPTION_MODEL`,
`EDITOR_MODEL`, and `DEBUG`. See `.env.example`.

---

## Style rules

- **Native CSS only.** Do not add Tailwind or another utility CSS framework.
- **No generic gray colors.** Use the brand-neutral CSS variables defined in `src/app.css`.
- **Palette** — define reusable colors as CSS custom properties in `src/app.css`.
- **Fonts** — declare via `<link>` in `src/app.html`; set a default body font, a display/title font, and `font-mono` for code/JSON.

---

## 📚 Client Libraries (`src/lib/js/`)

**Pattern:** thin wrappers over the API using `apiPost`/`apiGet` + debug logging. Components call these, never `fetch` directly.

```javascript
import { apiPost, apiGet } from '$lib/utils/fetch-utils.js';
import { logApiCall, logApiSuccess, logApiError } from '$lib/debug-toast.svelte.js';

export async function doThing({ text, file }) {
	const start = Date.now();
	logApiCall('Do thing');
	try {
		const data = new FormData();
		if (file) data.set('file', file);
		else data.set('text', text ?? '');
		const result = await apiPost('/api/do-thing', data); // apiPost sends FormData as-is
		logApiSuccess('Do thing', Date.now() - start);
		return result;
	} catch (err) {
		logApiError('Do thing', err);
		throw err;
	}
}
```

### Utils / Debug

- **`src/lib/utils/fetch-utils.js`** — `apiFetch`, `apiGet`, `apiPost` (object → JSON, `FormData` → sent as-is), `apiDelete` (throws `Error` with `.status`/`.data` on non-OK, reading the `error` field).
- **`src/lib/debug-toast.svelte.js`** — `logApiCall`, `logApiSuccess`, `logApiError`, `addDebugLog`; console always, on-screen toast only when `PUBLIC_DEBUG=true`.

---

## 🔧 Server Endpoints (`src/routes/api/`)

**Pattern:** `apiSuccess` / `apiError` / `validationError`, `createLogger`, Zod validation. Never call external AI/cloud services or touch credentials from the client.

```javascript
import { z } from 'zod';
import { apiSuccess, apiError, validationError } from '$lib/server/api-response.js';
import { createLogger } from '$lib/server/logger.js';

const logger = createLogger('Category/Endpoint');
const requestSchema = z.object({ field: z.string().min(1) });

export async function POST({ request }) {
	try {
		const data = await request.json();
		const validation = requestSchema.safeParse(data);
		if (!validation.success) return validationError(validation.error);
		const result = await doWork(validation.data.field);
		return apiSuccess({ result });
	} catch (err) {
		logger.error('Failed', err?.message || err);
		return apiError(err?.message || 'Internal error', err?.status || 500);
	}
}
```

### Server Helpers (`src/lib/server/`)

- **api-response.js:** `apiSuccess`, `apiError`, `validationError`, `handleApiError`
- **logger.js:** `createLogger` → `logger.debug/info/warn/error` (`debug` gated by `DEBUG=true`)
- _Add domain-specific server helpers here (AI clients, storage, scrapers). Keep all credential handling and third-party SDK calls server-only._

### Standards

- **Variables:** `data` (not `body`), `result` (not `response`), `fileName` (camelCase), `err` (in catch).
- **Logging:** `logger.debug/error` — never `console.log` in endpoints.
- **Responses:** `apiSuccess/apiError/validationError` — not raw `json()`.
- **Svelte 5 only:** `$state`/`$derived`/`$effect`/`$props` — no stores for component state.
- **Reuse first:** check existing utils before writing new code; never duplicate.

### File Structure

```
src/lib/
  js/         # client libs (thin API wrappers)
  server/     # server utils (api-response, logger, + domain helpers) — never bundled to client
  utils/      # shared utils (fetch-utils, etc.)
  components/ # Svelte components
  *.svelte    # view components, shared style modules
routes/
  api/        # endpoints
  <pages>/    # app pages (own only their input UI; share results UI via a common component)
```

**Reuse across pages:** app pages should own only their _input_ UI. Extract shared
result/display UI into a single component, and share server-side pipelines across
endpoints rather than duplicating them.

---

## Dev

- `npm run dev` → http://localhost:5173. **Always stop the server when done** (`pkill -f "vite dev"`) and never leave 5173 busy; stale servers make Vite fall back to 5174+.
