# Performance and encoding

## Inspect capabilities first

```bash
ffmpeg -hide_banner -version
ffmpeg -hide_banner -filters
ffmpeg -hide_banner -encoders
ffmpeg -hide_banner -hwaccels
ffmpeg -hide_banner -h filter=xfade
ffmpeg -hide_banner -h encoder=libx264
```

Do not infer a compiled feature solely from an FFmpeg version number.

## Highest-impact optimizations

1. **Avoid work.** Probe first, use source metadata, and skip streams that are not needed.
2. **Stream-copy when boundaries can be approximate.** `-c copy` avoids decode and encode.
3. **Seek before input.** Put `-ss` before `-i` for quick access to a selected region.
4. **Decode once.** Combine resize, frame-rate, pixel-format, and padding filters in one chain.
5. **Keep analysis frames small.** The model does not need source-resolution contact sheets.
6. **Normalize intermediates once, then concat with `-c copy`.** Avoid a second lossy assembly encode.
7. **Use bounded job concurrency.** Multiple FFmpeg processes each use internal threads; process-count times thread-count can oversubscribe the machine.
8. **Use a faster preset before lowering quality.** x264 presets trade CPU time for compression efficiency; CRF controls quality.

## Software H.264 defaults

Quick first cut:

```text
-c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p
```

Higher-quality delivery:

```text
-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p
```

Lower CRF means higher quality and larger files. Do not compare CRF values across unrelated codecs as if they were equivalent.

## Apple hardware encoder

The local FFmpeg has VideoToolbox support. It can speed up previews:

```text
-c:v h264_videotoolbox -b:v 8M -allow_sw 1 -pix_fmt yuv420p
```

Treat this as an optional, capability-gated preview path. Hardware output quality and rate control differ from x264, and some source/filter combinations still require software frame transfers. Keep x264 as the predictable fallback.

## Progress reporting

Use machine-readable progress:

```bash
ffmpeg -progress pipe:1 -nostats -i input.mp4 ... output.mp4
```

Parse `key=value` lines. A block ends with `progress=continue`; the final block ends with `progress=end`. Compare `out_time_us` with the known target duration for UI progress. Continue logging stderr separately because diagnostics remain there.

## Parallelism

- Parallelize independent source videos with a small worker limit.
- Do not launch one process per CPU core while also allowing every encoder to use all cores.
- Let FFmpeg choose threads (`-threads 0`, usually the default) unless measurements show a reason to override it.
- Audio extraction and lightweight image composition can overlap with video analysis, but avoid saturating disk reads from the same large source.
- Measure wall time and output quality before adopting hardware encoding or more workers.

## MP4 delivery

```text
-movflags +faststart
```

This moves MP4 metadata to the beginning for faster web playback. It performs a second pass over the completed file, so omit it for disposable intermediates and use it on the delivered movie.

## Temporary files

- Keep each run in its own generated working directory.
- Use deterministic clip names (`clip-000.mp4`) inside that directory.
- Delete temporary frames and intermediates after success; retain them in development when debugging is enabled.
- Never share a concat list or output filename between concurrent runs.
