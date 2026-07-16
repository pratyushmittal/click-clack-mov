# Sharp image recipes

Sharp is suitable for contact-sheet composition, timestamp labels, and lightweight image metadata. The project currently uses Sharp 0.35.3 with libvips 8.18.3.

## Read metadata cheaply

```javascript
import sharp from 'sharp';

const metadata = await sharp(filePath).metadata();
```

`metadata()` reads image headers without decoding all pixels. Use it to calculate layout before composition.

## Normalize a thumbnail

```javascript
const thumbnail = await sharp(framePath)
  .resize(320, 180, {
    fit: 'contain',
    background: '#111111'
  })
  .jpeg({ quality: 80 })
  .toBuffer();
```

- `contain` preserves the whole image and pads it.
- `cover` fills the box by cropping.
- `inside` only constrains maximum dimensions.
- The default resize kernel is Lanczos 3.

## Compose one contact sheet

```javascript
const sheet = sharp({
  create: {
    width: columns * cellWidth,
    height: rows * cellHeight,
    channels: 3,
    background: '#111111'
  }
});

await sheet
  .composite(items)
  .jpeg({ quality: 82 })
  .toFile(outputPath);
```

Each item can contain `{ input, left, top }`. Resize and rotate each frame before adding it to the composite; Sharp applies resize/rotate to the base image before the composite stage.

## Timestamp labels with SVG

This avoids depending on FFmpeg's optional `drawtext` filter:

```javascript
function timestampLabel(text, width) {
  return Buffer.from(`
    <svg width="${width}" height="32">
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.68)" />
      <text x="10" y="22" fill="white" font-size="16" font-family="monospace">${text}</text>
    </svg>
  `);
}
```

Only pass application-generated timestamp text into the SVG. Escape any external text before embedding it in XML.

## Speed and size

- JPEG quality defaults to 80; state it explicitly for reproducibility.
- `mozjpeg: true` can reduce JPEG size but is slower. Avoid it for live processing previews unless file size is the bottleneck.
- Sharp removes most metadata by default, which is appropriate for generated contact sheets.
- Do not change global `sharp.concurrency()` or cache settings casually; they affect all work in the process.
- Set a sensible `limitInputPixels` when accepting arbitrary images. Extracted frames already have controlled dimensions.
- Compose already-small thumbnails rather than full-resolution source frames.
