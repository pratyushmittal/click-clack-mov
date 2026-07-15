# Frontend Framework Integration

## Installing via npm (for bundlers)

```bash
npm install mathjax
```

This ships MathJax's prebuilt component files. In a bundled app you generally do **not** import it as a normal ES module for browser use — instead you either:

1. Load the component via a `<script>` tag pointing at a copied/served asset (simplest, avoids bundler edge cases with MathJax's dynamic component loader), or
2. Import `mathjax-full`'s internal modules directly and build a custom typesetting pipeline (more control, more setup — see `configuration.md` for the module-level API).

For most app integrations, option 1 combined with the browser-global `window.MathJax` config object is the least error-prone path, because MathJax's component loader expects to fetch sibling files (fonts, extensions) relative to its own script URL, which bundlers can break if you import it as a regular dependency.

## React

```jsx
import { useEffect, useRef } from 'react';

function Formula({ tex, display = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([ref.current]).catch(console.error);
    }
  }, [tex]);

  // LaTeX must be a plain string, never interpolated as JSX children directly
  // if it contains braces that JSX would try to parse as expressions.
  const wrapped = display ? `\\[${tex}\\]` : `\\(${tex}\\)`;

  return <span ref={ref}>{wrapped}</span>;
}
```

Load the MathJax script once in your HTML shell (`index.html` / `_document`), not per-component. For SSR frameworks (Next.js), guard against `window` being undefined during server render — typesetting must happen client-side only, typically in `useEffect`.

There's also `better-react-mathjax`, a community wrapper that handles script loading and a `<MathJaxContext>`/`<MathJax>` component pair if you'd rather not hand-roll the `useEffect` logic.

## Svelte / SvelteKit

Svelte's curly-brace interpolation collides with LaTeX's brace-heavy syntax the same way JSX does — always pass LaTeX as a string variable, never write raw LaTeX containing `{`/`}` directly in markup outside of an expression.

```svelte
<script>
  import { onMount, afterUpdate } from 'svelte';

  export let tex = '';
  export let display = false;

  let el;

  function typeset() {
    if (window.MathJax?.typesetPromise && el) {
      window.MathJax.typesetClear([el]);
      window.MathJax.typesetPromise([el]).catch(console.error);
    }
  }

  onMount(typeset);
  afterUpdate(typeset);
</script>

<span bind:this={el}>{display ? `\\[${tex}\\]` : `\\(${tex}\\)`}</span>
```

**SvelteKit SSR note:** MathJax's browser components assume `window`/`document` exist. Either:
- Load the CDN `<script>` tag only in `app.html` (runs client-side regardless), and gate all `MathJax.*` calls behind `browser` from `$app/environment`, or
- Do the typesetting server-side during `load()` using the Node-native approach in `node-ssr.md`, and ship pre-rendered SVG/MathML as static markup (no client JS needed at all — often the better choice for a content-heavy SvelteKit site, since it avoids layout shift entirely).

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  onMount(() => {
    if (browser && window.MathJax) {
      window.MathJax.typesetPromise();
    }
  });
</script>
```

**Vite bundling caveat:** if MathJax is bundled through Vite (e.g., in a Figma/FigJam plugin built with `vite-plugin-singlefile`), the component loader's dynamic `import()`/`require()` calls for on-demand extensions can be broken by the single-file bundling process, since MathJax expects to fetch additional files at runtime. For single-file plugin bundles, prefer:
- Pre-selecting every TeX package/extension you need at build time (avoid `\require` and autoloading in the document — see `configuration.md` for the explicit `load` list), so nothing needs to be fetched dynamically after the bundle is inlined, or
- Doing the LaTeX → SVG conversion in a Node-side build step (`node-ssr.md`) and embedding the resulting static SVG strings directly into the plugin's UI, sidestepping the in-browser MathJax runtime entirely — usually the more robust option for a single-file, no-network-fetch plugin context.

## Vue

Same braces caveat as React/Svelte (Vue templates also use `{{ }}` interpolation). Pattern is analogous: hold LaTeX in a ref, call `MathJax.typesetPromise([el])` in a `watch` or `onMounted`/`onUpdated` hook.

## General re-typesetting rule (all frameworks)

Every time math content changes reactively (new message, tab switch, route change), call:

```javascript
window.MathJax.typesetClear([el]);       // clear MathJax's internal state for that node first
await window.MathJax.typesetPromise([el]); // then retypeset
```

Skipping `typesetClear` before re-typesetting the same node can cause duplicate or stale output when the underlying TeX string changes.