# Troubleshooting

## Nothing renders / formulas show raw LaTeX text

- Check the script actually loaded: inspect network tab / console for 404s on the MathJax component file or its dependent chunks (fonts, extensions).
- If using a bundler, confirm MathJax's component loader isn't being intercepted/rewritten in a way that breaks its relative-path asset fetching (see the Vite single-file caveat in `frontend-integration.md`).
- Confirm `window.MathJax` config object is defined **before** the MathJax script tag executes — order matters. If the config script is injected after the component script (common with async component loading in frameworks), the config is ignored and defaults apply.
- If content was inserted dynamically (WebSocket/SSE, client-side route change, reactive framework update), remember MathJax does not auto-observe DOM mutations — you must call `MathJax.typesetPromise([el])` yourself after the content lands in the DOM.

## Math flashes as raw LaTeX text before typesetting ("FOUC" for math)

- This is expected with client-side typesetting: raw LaTeX source is in the DOM until the JS runs. Mitigations:
  - Hide the container with CSS (`visibility: hidden`) until `MathJax.typesetPromise()` resolves, then reveal it.
  - Prefer server-side pre-rendering (`node-ssr.md`) to ship already-typeset SVG/MathML in the initial HTML — eliminates the flash entirely and is generally the better solution for content-heavy pages (blogs, documentation) where the formula set is known at build time.

## Duplicate or corrupted output after content updates

- Call `MathJax.typesetClear([el])` before re-typesetting the same node when its LaTeX content changes reactively. Skipping this is the most common cause of stale/duplicated math after an update in React/Svelte/Vue components.

## `\require` or autoloaded packages fail in a bundled/offline context

- Autoloading (`\require{mhchem}` used directly in TeX source, or MathJax's automatic extension loading) needs to fetch additional files at runtime relative to the MathJax script's own URL. This breaks in:
  - Single-file bundles (e.g. `vite-plugin-singlefile`) where there's no separate file to fetch relative to.
  - Fully offline/sandboxed environments (some plugin runtimes, e.g. Figma plugin sandboxes, restrict network access).
  - Fix: explicitly declare every needed package in the `load` array at init time (see `configuration.md`) so nothing is loaded lazily.

## Performance: many formulas on one page is slow

- Batch DOM updates: call `MathJax.typesetPromise()` once for a batch of new elements rather than once per element in a loop.
- For large static content sets, prefer build-time Node pre-rendering (`node-ssr.md`) over client-side typesetting entirely — shifts the cost from every page load to a one-time build step.
- If self-hosting, ensure font files are served with proper cache headers — repeated font re-fetches across page loads are a common unnecessary bottleneck.

## Layout shift/reflow after typesetting

- CHTML output depends on web fonts loading, which can cause a reflow once fonts arrive if dimensions weren't reserved. SVG output avoids this since MathJax computes SVG dimensions synchronously without waiting on font files.
- Reserve container space (e.g., `min-height`) if using CHTML in a layout sensitive to shift.

## Version confusion (v2 vs v3 vs v4 API differences)

- `mathjax-node` (legacy, MathJax 2 API: `mjAPI.typeset(...)`) is **not** compatible with the modern `MathJax.init()` / `tex2svgPromise()` API used by the `mathjax` npm package (v3-style) or `@mathjax/src` (v4). Don't mix code samples from different eras — check which major version a tutorial or Stack Overflow answer targets before copying its API calls.
- `mathjax@4`'s node-native usage requires an explicit DOM adaptor (`adaptors/liteDOM` at minimum) that earlier simplified APIs handled implicitly — see `node-ssr.md`.

## Accessibility regressions after custom post-processing

- If you parse/manipulate MathJax's SVG or CHTML output (e.g., extracting it for a design tool, stripping wrapper elements), verify you haven't dropped the `role`, `aria-label`, or hidden assistive-MathML sibling nodes that ship in the default output — these are easy to lose in naive DOM manipulation or regex-based post-processing.