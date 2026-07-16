# Inspection and validation

Inspect media before editing it. Container extensions do not tell you enough about the streams inside.

## Compact JSON probe

```bash
ffprobe -v error \
  -show_entries 'format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,time_base,sample_aspect_ratio,display_aspect_ratio,sample_rate,channels,channel_layout:stream_tags=rotate:stream_side_data=rotation' \
  -of json \
  input.mp4
```

For unfamiliar or malformed files, prefer the complete view:

```bash
ffprobe -v error -show_format -show_streams -of json input.mp4
```

Useful focused probes:

```bash
# Duration in seconds
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 input.mp4

# First video stream
ffprobe -v error -select_streams v:0 -show_streams -of json input.mp4

# First audio stream; no output means the file is silent
ffprobe -v error -select_streams a:0 -show_streams -of json input.mp4
```

Use `avg_frame_rate` for observed average rate and `r_frame_rate` only as a stream rate hint. Preserve the original time base until a normalization step explicitly changes it.

## Keyframe inspection

Copy cuts are limited by keyframes. Inspect nearby frames when a copied trim starts too early or too late:

```bash
ffprobe -v error \
  -select_streams v:0 \
  -read_intervals '40%+15' \
  -show_entries frame=pts_time,key_frame,pict_type \
  -of csv=p=0 \
  input.mp4
```

`-read_intervals` seeks approximately; it is useful for diagnosis, not exact frame counting.

## Output validation

Run both checks after assembly:

```bash
ffprobe -v error -show_format -show_streams -of json output.mp4
ffmpeg -v error -xerror -i output.mp4 -f null -
```

The probe verifies structure. The decode pass catches damaged packets and decode failures that metadata alone cannot reveal.

Application-level postconditions should also check:

- output exists and has non-zero size;
- at least one video stream exists;
- duration is finite and within the expected tolerance;
- dimensions are even for common H.264 workflows;
- pixel format and codecs match the delivery contract;
- audio exists only when expected;
- no selected clip extends beyond its source duration.

## Optional quality comparison

The local FFmpeg includes `libvmaf`. When a reference file exists and quality matters:

```bash
ffmpeg -i distorted.mp4 -i reference.mp4 \
  -lavfi '[0:v]setpts=PTS-STARTPTS[dist];[1:v]setpts=PTS-STARTPTS[ref];[dist][ref]libvmaf=log_fmt=json:log_path=vmaf.json' \
  -f null -
```

VMAF requires aligned footage. It is not useful for judging creative edits where timing or content differs.
