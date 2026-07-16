# Visual analysis and contact sheets

A contact sheet should provide enough temporal coverage for editing without decoding or transmitting needless pixels.

## Fixed-interval frames

For exact 10-second cadence, FFmpeg must generally decode through the video:

```bash
ffmpeg -i input.mp4 \
  -vf 'fps=1/10,scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2' \
  -fps_mode vfr -q:v 4 \
  frame-%05d.jpg
```

For a faster overview, decode only keyframes and enforce a minimum interval between selected frames:

```bash
ffmpeg -skip_frame nokey -i input.mp4 \
  -vf "select='isnan(prev_selected_t)+gte(t-prev_selected_t,10)',scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,showinfo" \
  -fps_mode vfr -q:v 4 \
  frame-%05d.jpg
```

The keyframe version is substantially cheaper for long-GOP footage but does not guarantee exact intervals. Read `pts_time` from `showinfo` and use those real timestamps for labels.

## Representative frame per window

`thumbnail=N` buffers a batch and chooses a representative frame rather than the first one:

```bash
ffmpeg -i input.mp4 \
  -vf 'thumbnail=300,scale=320:180,tile=6x5' \
  -frames:v 1 \
  sheet.jpg
```

Larger batches use more memory. This is useful for an overview, but fixed timestamp labels are harder because selection is content-based.

## Scene-change candidates

Use scene detection to supplement, not replace, regular temporal samples:

```bash
ffmpeg -i input.mp4 \
  -vf 'scdet=t=10,metadata=print:file=scenes.txt' \
  -an -f null -
```

FFmpeg documents roughly `8` to `14` as a useful `scdet` threshold range, with `10` as the default. Scene thresholds are content-dependent; fast camera motion can create noisy detections.

A simpler extraction form is:

```bash
ffmpeg -i input.mp4 \
  -vf "select='gt(scene,0.35)',scale=320:-2" \
  -fps_mode vfr -q:v 4 \
  scene-%05d.jpg
```

Avoid a second dense extraction pass unless the first overview genuinely cannot support an edit decision. The current product goal is one timestamped contact sheet per source video.

## Detect unusable visual regions

```bash
# Long mostly-black sections
ffmpeg -i input.mp4 -vf 'blackdetect=d=2:pix_th=0.10' -an -f null -

# Suggest stable crop values; inspect output before applying
ffmpeg -i input.mp4 -vf 'cropdetect=limit=24:round=2:reset=0' -an -f null -
```

Detection output is diagnostic metadata, not an automatic editing decision. Night footage, fades, letterboxing, and intentional black frames can trigger false positives.

## Contact-sheet strategy for this project

1. Probe duration and rotation.
2. Pick an interval that keeps the sheet readable; shorter videos can use shorter intervals.
3. Extract small frames once, preferably with the keyframe-assisted command for speed.
4. Record the actual timestamp for every selected frame.
5. Compose one timestamped sheet with Sharp.
6. Keep the original source path/index in machine-readable metadata sent to the editor agent.

Do not rely on the visual ordering alone. The agent needs explicit timestamps and source identities.
