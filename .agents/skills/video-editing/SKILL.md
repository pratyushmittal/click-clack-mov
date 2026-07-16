---
name: video-editing
description: Practical, offline recipes for inspecting, trimming, normalizing, assembling, analysing, and validating video with FFmpeg/FFprobe and Sharp. Use this when changing the vlog editing pipeline, writing safe FFmpeg commands, generating contact sheets, improving media-processing speed, or debugging malformed outputs. Curated from official documentation and checked against the locally installed tools.
user-invocable: true
---

# Video editing with FFmpeg, FFprobe, and Sharp

Use this skill instead of reconstructing media commands from memory. It contains project-oriented recipes, not a complete copy of the upstream manuals.

## Start here

1. Inspect the input before choosing a command.
2. Inspect local capabilities before relying on a filter, encoder, or hardware accelerator.
3. Prefer stream copy only when approximate, keyframe-boundary cuts are acceptable.
4. Normalize clips before joining footage from different cameras.
5. Validate the finished file with both `ffprobe` and a full decode pass.
6. Pass arguments directly to `execFile`/`spawn`; never build a shell command from untrusted paths.

## Reference map

| Need | Read |
|---|---|
| Probe streams, duration, frame rate, rotation, or validate output | [inspection-and-validation.md](references/inspection-and-validation.md) |
| Cut clips, handle silent footage, concatenate, or add transitions | [trimming-and-assembly.md](references/trimming-and-assembly.md) |
| Extract frames, detect scenes, or make contact sheets | [visual-analysis.md](references/visual-analysis.md) |
| Extract transcription audio, detect silence, normalize loudness, or fade | [audio.md](references/audio.md) |
| Make processing faster or choose an encoder | [performance-and-encoding.md](references/performance-and-encoding.md) |
| Compose and label images with Sharp | [sharp.md](references/sharp.md) |
| Check documentation provenance and refresh local capabilities | [sources.md](references/sources.md) |

## Project defaults

These are sensible first-cut defaults, not universal truths:

- Delivery: H.264, `yuv420p`, AAC stereo, 48 kHz, MP4 with `+faststart`.
- Quick previews: prefer VideoToolbox when it supports the input and measurements show a useful speed-up.
- Normalized intermediates: use VideoToolbox for speed when its output is suitable; otherwise use `libx264`, `-preset veryfast`, `-crf 20` to `22`.
- Higher-quality final encode: compare VideoToolbox with `libx264`, `-preset medium`, `-crf 18` to `20`, and keep the option with the better measured speed/quality trade-off.
- Contact sheets: sample at a fixed interval, resize frames once, and compose/label with Sharp.
- Assembly: normalize each selected clip, then use the concat demuxer with stream copy.
- Progress UI: use FFmpeg's machine-readable `-progress pipe:1`, not human stderr parsing.

## Important constraints

- FFmpeg option order matters. Options apply to the next input or output and are reset between files.
- Filters require decoding and therefore cannot be combined with stream copy for that stream.
- Copy cuts generally start at a nearby keyframe; use an encoded trim for exact boundaries.
- The concat demuxer expects compatible streams. Resolution alone is not enough: codecs, time bases, pixel format, audio layout, and sample rate should match.
- `xfade` requires both video inputs to share resolution, pixel format, frame rate, and time base.
- Do not assume `drawtext`, subtitle rendering, or stabilization filters are installed. They are absent from the current local capability snapshot.

## Scope

This skill is for the coding agent. It is **not** exposed to the GPT-5.6 Terra movie-editing agent yet. If that is later desired, expose only a small audited subset of recipes rather than the whole reference bundle.
