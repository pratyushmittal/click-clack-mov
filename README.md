# Vlogger

Vlogger is a simple video trimmer, assembler, and AI movie maker that turns a collection of raw vlog files into a concise first cut.

## MVP interface

The main screen follows a deliberately small input flow:

- **Footage** — a large drop area for up to 12 source videos.
- **Vibe** — a text input describing the desired feeling and the kinds of moments to keep.
- **Target length** — defaults to 25% of the combined source duration and can be adjusted with a slider.

## How it works

1. The browser streams each selected source video to the local server process. The file is moved directly into its local job directory without a second copy or an application-level size limit.
2. FFmpeg extracts compressed mono audio. Audio is kept whole unless it approaches the transcription API's file-size limit, then it is divided into the fewest safe chunks.
3. Whisper generates segment-level timestamps that map spoken content precisely back to the source footage.
4. FFmpeg skips non-keyframes and samples representative keyframes at short intervals, avoiding a full decode of every frame. Sharp combines those frames into one timestamped contact sheet per source video. Sampling starts at one frame per second for short clips, settles at ten-second intervals for typical footage, and adapts for very long videos to keep the sheet readable.
5. GPT-5.6 Terra reviews every timestamped transcript and contact sheet together. It selects only the footage that serves the user's vibe and target length.
6. Terra acts as an editing agent with a sandboxed Bash tool. It can inspect media with FFprobe and run FFmpeg commands to trim, normalize, and assemble the movie itself.
7. Every Bash tool call includes a concise user-facing intent. The server records these intents in `status.json`, and the interface polls the local status endpoint to show live editing feedback without exposing private chain-of-thought.
8. The agent writes the finished first cut to `vlogger-cut.mp4` and returns the exact source boundaries it used.

The Bash tool runs inside the current job directory, cannot access the network, cannot read other files in the user's home directory, and receives no API credentials. Silent clips can be given a silent audio track when the agent combines them with spoken footage.

## Requirements

- Node.js
- FFmpeg and FFprobe available on `PATH`
- An OpenAI or OpenRouter API key with access to Whisper and GPT-5.6 Terra

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

Set either `OPENAI_API_KEY` or `LLM_API_KEY` in `.env`. OpenRouter keys are detected automatically and use the corresponding `openai/whisper-1` and `openai/gpt-5.6-terra` model names.

## Tests

Install Chromium once, then run the suite:

```bash
npx playwright install chromium
npm test
```

The Playwright suite starts the local SvelteKit server and exercises the browser-facing workflow with small committed video fixtures. External AI calls are mocked, while file selection, metadata reading, target-length calculation, status polling, continuous video playback, contact-sheet sequencing, the editing slideshow, and the final result view run in a real Chromium browser.

Use `npm run test:e2e:ui` to inspect and debug the flow interactively.

## Processing view

After submission, the drop area becomes a minimal processing stage with only three elements: media, a title, and one line of detail. During analysis it continuously plays the currently focused source video until that video's transcript and contact sheet are ready, then advances to the next active video. Status polling does not restart playback. During editing it shows every completed contact sheet once, then switches to a four-second slideshow of random source-video glimpses that continues independently of long-running Bash calls. Each Bash tool call also picks a light-hearted progress title while its intent remains visible as the detail.

## Performance

Video analysis runs two source files at a time by default. For each source, contact-sheet generation and audio transcription also run in parallel. Oversized audio chunks are transcribed two at a time.

The concurrency can be adjusted in `.env`:

```env
VIDEO_CONCURRENCY=2
TRANSCRIPTION_CONCURRENCY=2
```

Values from 1–4 are accepted. Higher values can improve throughput on a powerful machine, but may increase disk contention, CPU usage, memory usage, and API rate-limit errors.

## Commands

- `npm run dev` — start the development server
- `npm run check` — run Svelte diagnostics
- `npm run lint` — check formatting and lint the code
- `npm run format` — format the project
- `npm run build` — create a production build

## Local output

When `DEBUG=true`, the server prints the absolute job directory as soon as processing starts:

```text
[MoviePipeline] Job directory /absolute/path/to/.vlogger/jobs/<job-id>
```

This development-only log makes it easy to inspect transcripts, contact sheets, agent intermediates, and the current render while the job is running.

Generated source files, audio chunks, contact sheets, edit decisions, live status and intent history, and movies are stored under `.vlogger/jobs/<job-id>/`. This directory is ignored by Git. The MVP does not yet remove old jobs automatically.

## Current scope

This is a local, single-user MVP. Processing happens in one request, so the browser tab must remain open while the movie is being analyzed and rendered. Production deployment will need background jobs, durable object storage, appropriate transfer limits, authentication, cleanup policies, and progress events.
