# Node.js / Server-Side Rendering (no browser)

Use this when you need to convert LaTeX (or MathML) to static SVG/MathML/HTML strings at build time or on a server — e.g. pre-rendering equations for a static site, embedding SVG into a PDF pipeline, or generating formula assets for a design-tool plugin without shipping a full MathJax runtime to the client.

## Package choice

- **`mathjax` (npm, currently tracks MathJax 3's simplified API)** — easiest entry point for basic TeX/MathML → SVG/CHTML/MathML conversion in a Node script. Good default for most SSR needs.
- **`@mathjax/src`** — the MathJax 4 source package, for lower-level control (custom component sets, non-browser DOM adaptors, integrating into a larger TypeScript build pipeline).
- **`mathjax-node` / `mathjax-node-cli`** — older, MathJax 2-era API. Still referenced in some tutorials; avoid for new projects unless maintaining legacy code, since it predates the modern component/loader architecture.

## Basic conversion (mathjax v3 simplified API)

```bash
npm install mathjax
```

```javascript
import { mathjax } from 'mathjax-full/js/mathjax.js';
// Simpler entry point via the top-level package:
import MathJax from 'mathjax';

await MathJax.init({
  loader: { load: ['input/tex', 'output/svg'] }
});

const svgNode = await MathJax.tex2svgPromise('\\frac{1}{x^2 - 1}', { display: true });
const svgString = MathJax.startup.adaptor.outerHTML(svgNode);
// svgString is a self-contained <mjx-container> wrapping an <svg> — write it to disk or embed directly
```

Other conversion methods on the same object: `tex2mmlPromise`, `tex2chtmlPromise`, `mathml2svgPromise` — pick input/output to match your `loader.load` list (e.g. load `input/mml` instead of `input/tex` if converting MathML).

## MathJax 4 / `@mathjax/src` (non-browser DOM adaptor required)

MathJax 4's node path requires an explicit non-browser DOM adaptor since there's no `window`/`document`:

```javascript
global.MathJax = {
  loader: {
    paths: { mathjax: '@mathjax/src/bundle' },
    load: ['adaptors/liteDOM'],
    require: require
  }
};
require('@mathjax/src/bundle/tex-svg.js');

MathJax.startup.promise
  .then(() => {
    const svg = MathJax.tex2svg('E = mc^2', { display: true });
    console.log(MathJax.startup.adaptor.outerHTML(svg));
  })
  .catch((err) => console.error(err.message))
  .then(() => MathJax.done());
```

`liteDOM` is MathJax's lightweight built-in DOM implementation — sufficient for typesetting. If you need a fuller DOM (e.g., for extensions that touch layout APIs a lite DOM doesn't implement), MathJax also provides adaptors for `jsdom` and `linkedom`, or you can drive an actual headless browser (Puppeteer) for full-fidelity rendering at the cost of much higher overhead — only reach for that if liteDOM demonstrably fails for your input.

## Batch/build-step pattern

For a static site or plugin build step that needs many formulas converted once:

```javascript
import MathJax from 'mathjax';

const mj = await MathJax.init({ loader: { load: ['input/tex', 'output/svg'] } });

async function renderAll(formulas) {
  const results = {};
  for (const [id, tex] of Object.entries(formulas)) {
    const node = await MathJax.tex2svgPromise(tex, { display: false });
    results[id] = MathJax.startup.adaptor.outerHTML(node);
  }
  return results;
}
```

Run this once at build time (Vite plugin hook, SvelteKit `+page.server.js` `load`, or a standalone pre-build script) and inline the resulting SVG strings — this avoids shipping the MathJax runtime to the browser entirely when the formula set is known ahead of time and doesn't change at runtime.

## Font handling for SVG output in Node

`output/svg` embeds glyph paths inline by default when `fontCache` isn't set to `'global'`, producing fully self-contained SVGs safe to drop into any context (email, PDF, a design tool's canvas) with no external font dependency. If you set `svg: { fontCache: 'global' }`, MathJax instead emits `<use>` references into a shared `<defs>` block, which is smaller for pages with many repeated formulas but requires that shared `<defs>` block to be present wherever the SVG is placed — don't use `fontCache: 'global'` for isolated/exported SVG snippets.