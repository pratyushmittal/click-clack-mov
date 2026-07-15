# Configuration: Packages, Macros, Delimiters, Fonts

## Input packages (TeX)

MathJax's TeX input is modular — load only what you need to keep payload/startup cost down. Common packages beyond the `base` set:

| Package | Use case |
|---|---|
| `ams` | AMS math environments (`align`, `gather`, `\text{}`, extra symbols) — load this almost always |
| `mhchem` | Chemistry equations (`\ce{H2O}`) |
| `physics` | Physics notation (bra-ket, derivatives shorthand) |
| `boldsymbol` | `\boldsymbol{}` support |
| `color` | `\color{}` |
| `cancel` | `\cancel{}` strikethrough |
| `newcommand` | User-defined `\newcommand`/`\def` (on by default in most combined components) |
| `noundefined` | Renders undefined macros in red instead of throwing — useful in dev, consider disabling in production for stricter validation |

Specify explicitly rather than relying on autoloading when performance or predictability matters (e.g., single-file bundled plugins — see `frontend-integration.md`'s Vite/single-file caveat):

```javascript
window.MathJax = {
  loader: { load: ['input/tex', 'output/svg', '[tex]/mhchem', '[tex]/ams'] },
  tex: { packages: { '[+]': ['mhchem', 'ams'] } }
};
```

## Custom macros

Define reusable shorthand once in config rather than repeating raw LaTeX everywhere:

```javascript
window.MathJax = {
  tex: {
    macros: {
      RR: '{\\mathbb{R}}',
      ket: ['{|#1\\rangle}', 1],   // takes 1 argument
      norm: ['{\\left\\lVert #1 \\right\\rVert}', 1]
    }
  }
};
```

`\ket{\psi}` then expands to `|\psi\rangle`. The array form `[template, argCount]` is required whenever the macro takes arguments.

## Delimiters

Default combined components typically enable both `$...$` and `\(...\)` for inline, `$$...$$` and `\[...\]` for display. Reconfigure explicitly to avoid the currency-symbol collision noted in the main SKILL.md:

```javascript
window.MathJax = {
  tex: {
    inlineMath: [['\\(', '\\)']],     // disable single-$ inline delimiters
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true              // allow \$ to produce a literal dollar sign
  }
};
```

## Output format tradeoffs (expanded)

| Output | Pros | Cons |
|---|---|---|
| `output/svg` | Self-contained, crisp at any zoom, no web-font dependency (with per-glyph paths), good for embedding/export | Slightly larger DOM per formula than CHTML in some cases |
| `output/chtml` | Marginally better text copy/paste fidelity | Requires MathJax web fonts (CDN or self-hosted); FOUC risk if fonts load late |
| `output/mml` (MathML passthrough) | Semantic, best for accessibility tooling and downstream MathML consumers | Native browser MathML rendering quality varies; not a visual renderer by itself in all browsers |

Default recommendation: **SVG**, unless you specifically need MathML for a downstream consumer or CHTML's copy-paste behavior.

## Fonts

MathJax 4 introduced a modular font system with smaller per-glyph downloads (relevant if self-hosting rather than using a CDN). If self-hosting, mirror the full font directory structure from the npm package or CDN release rather than cherry-picking files — MathJax's loader resolves font assets by relative path and will 404 on missing pieces silently degrading to fallback glyphs.

To use a different math font (e.g., STIX2 instead of the default):

```javascript
window.MathJax = {
  loader: { load: ['[tex]/ams'] },
  svg: { font: 'mathjax-stix2' }  // or 'mathjax-modern', 'mathjax-fira', etc., per font extension installed
}
```

## Line breaking and long formulas

For display equations that may overflow narrow containers (mobile viewports, sidebar UIs, FigJam-style narrow canvases), enable automatic line-breaking:

```javascript
window.MathJax = {
  chtml: { linebreaks: { automatic: true } },
  svg: { linebreaks: { automatic: true } } // SVG line-breaking support is more limited than CHTML's
}
```

Note SVG output has more limited automatic line-breaking support than CHTML — if long multi-line formulas in narrow containers are a core requirement, CHTML may be the better output choice despite its font-loading tradeoff.