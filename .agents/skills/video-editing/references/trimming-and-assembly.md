# Trimming and assembly

## Choose the cut type deliberately

### Fast, approximate copy cut

Use for previews or already keyframe-aligned cuts:

```bash
ffmpeg -ss 42.5 -i input.mp4 -t 9.3 \
  -map 0:v:0 -map '0:a:0?' \
  -c copy -avoid_negative_ts make_zero \
  clip.mp4
```

This avoids decoding and encoding, so it is fast and lossless. The actual video boundary may move to a nearby keyframe, and source timestamps can still make some files awkward.

### Exact, normalized cut with audio

Use for footage from mixed cameras and for final edit decisions:

```bash
ffmpeg -ss 42.5 -i input.mp4 -t 9.3 \
  -map 0:v:0 -map 0:a:0 \
  -vf 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p' \
  -af 'aresample=48000:async=1:first_pts=0' \
  -c:v libx264 -preset veryfast -crf 20 \
  -c:a aac -b:a 192k -ac 2 -ar 48000 \
  -movflags +faststart \
  clip.mp4
```

Placing `-ss` before `-i` provides fast input seeking. FFmpeg decodes from the seek point as needed when encoding, giving an accurate output boundary in normal inputs.

### Exact, normalized cut from silent footage

Give every intermediate the same audio layout so later concatenation remains simple:

```bash
ffmpeg -ss 42.5 -i silent-input.mp4 \
  -f lavfi -t 9.3 -i 'anullsrc=r=48000:cl=stereo' \
  -t 9.3 \
  -map 0:v:0 -map 1:a:0 \
  -vf 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p' \
  -c:v libx264 -preset veryfast -crf 20 \
  -c:a aac -b:a 192k -ac 2 -ar 48000 \
  -shortest -movflags +faststart \
  clip.mp4
```

Probe for an audio stream first, then choose one of the two recipes. Optional mapping alone (`-map '0:a:0?'`) creates a video-only clip and can make a mixed concat fail.

## Aspect-ratio policy

The scale-and-pad recipe preserves the full frame and letterboxes/pillarboxes it. For a full-bleed crop, use:

```text
scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1
```

Make this a user/product decision. Do not silently crop faces or important edge content.

## Assemble normalized clips

Write an ffconcat file:

```text
ffconcat version 1.0
file 'clip-000.mp4'
file 'clip-001.mp4'
file 'clip-002.mp4'
```

Then concatenate without another lossy encode:

```bash
ffmpeg -f concat -safe 0 -i clips.ffconcat \
  -c copy -movflags +faststart \
  vlogger-cut.mp4
```

Only use `-safe 0` when the application created and controls the list. Escape ffconcat paths correctly; do not interpolate arbitrary user text into the file.

The concat demuxer is the simplest project default because all intermediates are deliberately normalized. Use the concat filter only when streams must be filtered together or cannot first be normalized.

## Filter-based trim

Inside a larger filter graph, reset timestamps after trimming:

```text
[0:v]trim=start=42.5:end=51.8,setpts=PTS-STARTPTS[v];
[0:a]atrim=start=42.5:end=51.8,asetpts=PTS-STARTPTS[a]
```

`trim`/`atrim` do not reset timestamps by themselves.

## Crossfade two normalized clips

If clip A is 8 seconds and the transition is 0.5 seconds, the video offset is `7.5`:

```bash
ffmpeg -i a.mp4 -i b.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=7.5[v];[0:a][1:a]acrossfade=d=0.5[a]" \
  -map '[v]' -map '[a]' \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart \
  output.mp4
```

`xfade` requires matching resolution, pixel format, frame rate, and time base. Multi-clip transition graphs grow quickly; prefer hard cuts unless transitions materially improve the edit.
