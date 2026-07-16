# Sources and freshness

Verified against official documentation on **July 16, 2026**.

## Official documentation

### FFmpeg

- Documentation index, regenerated nightly: https://ffmpeg.org/documentation.html
- Main command-line tool: https://ffmpeg.org/ffmpeg.html
- Filters: https://ffmpeg.org/ffmpeg-filters.html
- Formats, concat demuxer, segment muxer, and MP4 options: https://ffmpeg.org/ffmpeg-formats.html
- Codecs and encoders: https://ffmpeg.org/ffmpeg-codecs.html
- FFprobe: https://ffmpeg.org/ffprobe.html

### Sharp

- Documentation: https://sharp.pixelplumbing.com/
- Input metadata: https://sharp.pixelplumbing.com/api-input/
- Resize: https://sharp.pixelplumbing.com/api-resize/
- Composite and operations: https://sharp.pixelplumbing.com/api-composite/ and https://sharp.pixelplumbing.com/api-operation/
- Output: https://sharp.pixelplumbing.com/api-output/
- Utility, cache, concurrency, and SIMD: https://sharp.pixelplumbing.com/api-utility/

## Local capability snapshot

Captured July 16, 2026:

- FFmpeg 8.1.2
- Sharp 0.35.3
- libvips 8.18.3
- Apple VideoToolbox hardware acceleration available
- Encoders include `libx264`, `libx265`, `libsvtav1`, `libvpx-vp9`, `h264_videotoolbox`, `hevc_videotoolbox`, ProRes, AAC, MP3, Opus, and FLAC
- Relevant filters include `trim`, `atrim`, `concat`, `scale`, `pad`, `fps`, `thumbnail`, `tile`, `scdet`, `blackdetect`, `cropdetect`, `silencedetect`, `silenceremove`, `loudnorm`, `xfade`, `acrossfade`, and `libvmaf`
- `drawtext`, subtitle rendering, and video stabilization filters were not present in the inspected filter list

Refresh this snapshot after changing machines or reinstalling FFmpeg:

```bash
ffmpeg -hide_banner -version
ffmpeg -hide_banner -filters
ffmpeg -hide_banner -encoders
ffmpeg -hide_banner -hwaccels
node -e "const sharp=require('sharp'); console.log(sharp.versions); console.log({ concurrency: sharp.concurrency(), simd: sharp.simd() })"
```

## Maintenance rule

The recipes are intentionally small and project-specific. When a needed feature is absent, check the relevant official manual and update only the affected recipe. Do not vendor the entire FFmpeg manual into the repository.
