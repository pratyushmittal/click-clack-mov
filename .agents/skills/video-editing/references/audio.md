# Audio processing

## Transcription audio

Speech transcription does not need the source video bitrate or channel count:

```bash
ffmpeg -i input.mp4 \
  -map 0:a:0 -vn \
  -ac 1 -ar 16000 -b:a 48k \
  transcription.mp3
```

Probe for audio first. A video may be intentionally silent even when it is otherwise valid.

Split compressed audio according to the transcription API's byte limit, not an arbitrary one-minute duration. Estimate a safe segment duration from the encoded bitrate, retain a small safety margin for container overhead, and preserve each chunk's source-time offset when merging timestamps.

## Detect silence

```bash
ffmpeg -i input.mp4 \
  -af 'silencedetect=noise=-35dB:d=1.0' \
  -f null -
```

Threshold and duration depend on the recording. Wind, room tone, music, and camera preamps can prevent literal silence. Treat results as editing hints, not automatic deletions.

## Loudness normalization

For previews, a one-pass normalization is often enough:

```bash
ffmpeg -i input.mp4 \
  -af 'loudnorm=I=-16:LRA=11:TP=-1.5' \
  -c:v copy -c:a aac -b:a 192k \
  preview.mp4
```

For consistent final output, use two passes. First measure:

```bash
ffmpeg -i input.mp4 \
  -af 'loudnorm=I=-16:LRA=11:TP=-1.5:print_format=json' \
  -f null -
```

Parse the JSON from stderr and supply the measured values in the second pass:

```text
loudnorm=I=-16:LRA=11:TP=-1.5:
measured_I=<input_i>:measured_LRA=<input_lra>:
measured_TP=<input_tp>:measured_thresh=<input_thresh>:
offset=<target_offset>:linear=true:print_format=summary
```

Do not copy example measurement values between files. They are input-specific.

## Fades

```text
# 250 ms fade in
-afade=t=in:st=0:d=0.25

# 250 ms fade out on a 9.3-second clip
-afade=t=out:st=9.05:d=0.25
```

For two clips, use `acrossfade=d=0.5`. Video and audio transition durations should normally agree.

## Silent clips

To keep all normalized intermediates concat-compatible, add stereo silence:

```text
-f lavfi -t <duration> -i anullsrc=r=48000:cl=stereo
```

Map this generated stream only when the source has no usable audio. See the complete command in `trimming-and-assembly.md`.
