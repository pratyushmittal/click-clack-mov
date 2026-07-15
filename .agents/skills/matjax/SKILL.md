---
name: mathjax-rendering
description: Comprehensive guide for rendering mathematical notation (LaTeX, MathML, AsciiMath) on the web using MathJax. Use this skill whenever the user wants to display formulas, equations, or mathematical notation in a browser, a Node.js server, a static site, or a framework (React, Svelte, SvelteKit, Vue, vanilla HTML). Covers browser CDN setup, npm/bundler integration (Vite, webpack), server-side/Node rendering to SVG or MathML for pre-rendering and PDF pipelines, TeX/MathML configuration (packages, macros, delimiters), output format tradeoffs (CHTML vs SVG vs MathML), accessibility, and performance/caching. Trigger this skill even if the user just says "render math," "typeset LaTeX," "add equations to my site/app," or mentions MathJax, KaTeX-vs-MathJax comparisons, or formula rendering in a Figma/FigJam plugin, static site generator, or documentation tool — don't wait for them to name MathJax explicitly.
---

# MathJax Rendering

MathJax is a JavaScript display engine that typesets LaTeX, MathML, or AsciiMath input into browser-renderable output (CHTML, SVG, or MathML). As of this writing, **MathJax 4** is current; the npm `mathjax` package still ships MathJax 3 components under the hood in some contexts, so always verify the installed major version against `node_modules/mathjax/package.json` or the CDN tag before troubleshooting version-specific behavior.

Use this file for the decision tree and quick recipes. Read a `references/*.md` file only when the task lands in that area — don't load them all at once.

## Step 0: Confirm MathJax is the right tool

If the user hasn't already committed to MathJax, briefly check whether **KaTeX** is a better fit — it renders synchronously and is faster for the common case (no `\require`, no dynamic package loading, simpler LaTeX subset). Recommend MathJax specifically when the task needs:
- Full LaTeX/AMS-math coverage (uncommon macros, `\newcommand`, physics/chemistry packages like `mhchem`, `physics`)
- MathML output for accessibility or semantic markup
- Server-side/Node pre-rendering to static SVG (no client-side JS needed at render time)
- Built-in accessibility (speech generation, expression explorer)

If the user has already said "MathJax" or the project already depends on it, skip the comparison and proceed.

## Step 1: Identify the integration context

| Context | Go to |
|---|---|
| Plain HTML page, CDN script tag | "Browser: CDN" below |
| Bundled app (Vite, webpack, SvelteKit, React, Vue) | `references/frontend-integration.md` |
| Node.js script / server pre-rendering formulas to static SVG/MathML (no browser) | `references/node-ssr.md` |
| Need to tune input/output packages, macros, delimiters, or fonts | `references/configuration.md` |
| Something isn't rendering, is slow, or layout jumps/flickers | `references/troubleshooting.md` |

## Browser: CDN (simplest case)

For a static page or quick prototype, load the combined component from a CDN — no npm install needed:

```html
<script>
  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']]
    },
    svg: { fontCache: 'global' }
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@4/tex-svg.js" defer></script>
```

Then just write LaTeX in the page body: `The formula $E = mc^2$ is well known.` MathJax scans the DOM on load and typesets automatically.

**Combined component choice:**
- `tex-svg.js` — TeX input, SVG output. Best default: crisp at any zoom, no web font loading required, works well for pre-rendering and print/PDF.
- `tex-chtml.js` — TeX input, CHTML (HTML+CSS) output. Slightly better text selection/copy-paste behavior, needs MathJax web fonts loaded.
- `tex-mml-chtml.js` — adds MathML output alongside CHTML, larger payload, best when downstream tools consume MathML.
- `mml-chtml.js` — MathML input only, if your source documents are already MathML rather than LaTeX.

**Reprocessing dynamic content:** if the DOM changes after initial load (e.g., a chat message with LaTeX arrives via WebSocket/SSE), you must re-trigger typesetting — MathJax doesn't watch the DOM automatically:

```javascript
MathJax.typesetPromise([newElement]).catch((err) => console.error(err));
```

Always pass the specific changed element(s) rather than omitting the argument (which re-scans the whole page and is slower, and can double-render already-typeset nodes if not cleared first with `MathJax.typesetClear([el])`).

## Quick decision: SVG vs CHTML output

Default to **SVG** output unless you have a specific reason to prefer CHTML:
- SVG: self-contained, no external font files, scales perfectly, safe inside `<foreignObject>` or when embedding into other SVG/canvas contexts (relevant for design-tool plugins that manipulate vector graphics, e.g. a Figma/FigJam plugin canvas).
- CHTML: marginally better copy/paste of the rendered math as text, but depends on MathJax web fonts being reachable (CDN or self-hosted `.woff` files).

## Escaping pitfalls (the most common failure mode)

- **Markdown processors** often treat `_` and `*` as emphasis markers, mangling LaTeX subscripts (`x_1`) and multiplication. Configure the Markdown renderer to skip math regions, or process math before Markdown.
- **JSX/Svelte templates** treat `{` and `}` as expression delimiters. LaTeX is full of braces (`\frac{1}{2}`), so LaTeX strings must be passed as *string literals*, not interpolated as template syntax — see `references/frontend-integration.md` for exact patterns per framework.
- **Dollar signs as literal currency** (`$5`) will be misparsed as math delimiters if `inlineMath` includes `$...$`. Prefer `\(...\)` for inline math and reserve `$` delimiters for contexts with no literal currency, or disable single-dollar delimiters entirely.

## Accessibility

MathJax's output includes ARIA attributes and (for `tex-svg`/`tex-chtml`) an assistive-MathML layer plus optional speech string generation out of the box — no extra configuration typically needed for basic screen-reader support. Don't strip `role`, `aria-*`, or the hidden assistive MathML on the rendered nodes when post-processing output (e.g., when serializing SVG for a design tool), or accessibility support is lost silently.

## When to go deeper

- Framework-specific mounting, lifecycle, and SSR-safety (React/Svelte/SvelteKit/Vue) → `references/frontend-integration.md`
- Rendering LaTeX to SVG/MathML strings in a Node script/build pipeline, no browser DOM → `references/node-ssr.md`
- Custom macros, `\newcommand`, chemistry (`mhchem`), physics notation, font choice, delimiter customization → `references/configuration.md`
- Nothing renders, math flashes unstyled then reflows, memory/perf issues at scale → `references/troubleshooting.md`