# Vlogger

Vlogger is a macOS-only video trimmer, assembler, and AI movie maker that turns a collection of raw vlog files into a concise first cut.

## Platform

Vlogger deliberately targets macOS only. The application may rely on macOS-specific tools and media APIs such as `sandbox-exec`, VideoToolbox, AudioToolbox, AVFoundation, Core Media, Core Image, and Metal when they make processing faster or improve the result. We do not need to maintain Linux or Windows compatibility.

For video processing, prefer hardware-accelerated decoding and encoding when it is supported and measurements show a meaningful speed benefit. Keep a macOS software path for unsupported formats and quality-sensitive operations where hardware encoding is not the best trade-off.

## MVP interface

The main screen follows a deliberately small input flow:

- **Footage** — a large drop area for any number of source videos.
- **Vibe** — a text input with presets for teasers, vlogs, story mode, reels, and slick cuts.
- **Target length** — a compact optional minutes field. It defaults to 25% of the combined source duration, preset chips can replace it, and story mode removes the time limit entirely.

## Background music

The editing agent receives the curated tracks under `./music`, plus precomputed aubio beat/onset timestamps, BPM and FFmpeg loudness measurements under `./music-analysis`. A full-library waveform overview is sent as image input, and detailed timestamped timelines can be opened with `load_image`. Run `npm run analyze:music` after changing `sounds/library.json` or replacing a curated track.

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

- macOS
- Node.js
- Homebrew `ffmpeg-full` and FFprobe available on `PATH`; this includes the text and subtitle renderers omitted by the smaller `ffmpeg` formula
- aubio available on `PATH` when adding or replacing curated music tracks
- An OpenAI or OpenRouter API key with access to Whisper and GPT-5.6 Terra

## Setup

Install the complete FFmpeg build once. It is keg-only, so place it before the smaller `ffmpeg` formula on `PATH`:

```bash
brew install ffmpeg-full
echo 'export PATH="$(brew --prefix ffmpeg-full)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
hash -r
```

Verify the caption filters:

```bash
ffmpeg -hide_banner -filters 2>/dev/null | grep -E 'drawtext|subtitles| ass '
```

Then install and run Vlogger:

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

Video analysis runs two source files at a time by default. For each source, contact-sheet generation and audio transcription also run in parallel. Oversized audio chunks are transcribed two at a time. Future processing changes may use VideoToolbox, AudioToolbox, Metal, or other macOS media APIs instead of preserving cross-platform implementations.

The concurrency can be adjusted in `.env`:

```env
VIDEO_CONCURRENCY=2
TRANSCRIPTION_CONCURRENCY=2
EDITOR_MAX_TURNS=50
```

Values from 1–4 are accepted. Higher values can improve throughput on a powerful machine, but may increase disk contention, CPU usage, memory usage, and API rate-limit errors.

`EDITOR_MAX_TURNS` limits complete model/tool round trips, not only successful Bash calls. It defaults to 50 and accepts values from 4–64. Keep a finite limit to stop broken retry loops; raise it for unusually complex edits such as burned captions, subtitles, or several render-validation passes. More turns can increase runtime and model cost.

To temporarily skip audio extraction and transcription, use:

```env
DISABLE_TRANSCRIPTION=true
```

The editor will still receive every contact sheet and will treat each source as visual-only footage. Remove the setting or change it to `false` to restore transcription.

## Commands

- `npm run dev` — start the development server
- `npm run check` — run Svelte diagnostics
- `npm run lint` — check formatting and lint the code
- `npm run format` — format the project
- `npm run build` — create a production build
- `npm run analyze:music` — regenerate music beat maps, loudness data, and waveform timelines

## Local output

When `DEBUG=true`, the server prints the absolute job directory as soon as processing starts:

```text
[MoviePipeline] Job directory /absolute/path/to/.vlogger/jobs/<job-id>
```

This development-only log makes it easy to inspect transcripts, contact sheets, agent intermediates, and the current render while the job is running.

Transcripts are cached across jobs under `.vlogger/cache/transcriptions/`. The cache key includes the source video's SHA-256 content hash, the transcription model, and the cache format version. Renaming a byte-identical file still reuses its transcript; changing the file or transcription model creates a new entry. Duplicate files being processed concurrently also share one transcription request.

Generated source files, audio chunks, contact sheets, edit decisions, live status, and movies are stored under `.vlogger/jobs/<job-id>/`. Each job also keeps an append-only `agent-history.jsonl` containing the model instructions, user input, raw model responses, Bash tool calls and results, validation turns, final edit, and errors. Embedded base64 media is replaced with a short placeholder containing its MIME type and original character count. This directory is ignored by Git and can contain private footage metadata and transcripts. The MVP does not yet remove old jobs automatically.

## Current scope

This is a local, single-user, macOS-only MVP. Processing happens in one request, so the browser tab must remain open while the movie is being analyzed and rendered. The product is not intended to support Linux or Windows. A more durable macOS release will need background jobs, cleanup policies, recovery after interruption, and progress events that do not depend on an open browser request.
