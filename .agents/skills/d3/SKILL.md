---
name: d3js
description: Build data visualizations with D3.js (v7) — every chart family from the D3 Graph Gallery (d3-graph-gallery.com) plus the wider D3 ecosystem. Use this skill whenever the user wants to create, edit, debug, or explain a chart, graph, plot, map, or interactive dataviz in D3, or mentions D3, d3.js, SVG charts, or any specific chart type (barplot, scatter, line, area, histogram, boxplot, violin, heatmap, treemap, sankey, chord, network/force graph, choropleth, hexbin map, dendrogram, circle packing, streamgraph, radar/spider, lollipop, parallel coordinates, wordcloud, arc diagram, edge bundling, etc.), even if they don't name D3 explicitly. Also use for D3 scales, axes, transitions, tooltips, zoom/brush interactivity, GeoJSON/TopoJSON maps, hierarchy layouts, and helper libraries (d3-sankey, d3-hexbin, d3-cloud, topojson, d3-geo projections, d3-force).
---

# D3.js Visualization Skill

Authoritative, copy-adaptable D3 **v7** patterns covering the full D3 Graph Gallery taxonomy and the surrounding ecosystem. Prefer these patterns over recalled snippets — D3's API changed substantially across v3→v4→v5/6→v7 and stale idioms are a common source of bugs.

## First: settle the environment

Ask (or infer) two things before writing code:

1. **Delivery target** — standalone `.html` file, a React/Svelte component, or an inline artifact? This dictates how D3 is loaded and how the DOM node is obtained.
2. **D3 version** — default to **v7** (current). All code here is v7. Note the migration gotchas in `references/core.md` if the user is on an older version.

### Loading D3 (standalone HTML)

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
```

Ecosystem modules load as additional scripts, e.g.:
```html
<script src="https://cdn.jsdelivr.net/npm/d3-sankey@0.12"></script>
<script src="https://cdn.jsdelivr.net/npm/d3-hexbin@0.2"></script>
<script src="https://cdn.jsdelivr.net/npm/d3-cloud@1"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3"></script>
```

### Loading D3 (ESM / bundler / React)

```js
import * as d3 from "d3";
// submodules: import { sankey, sankeyLinkHorizontal } from "d3-sankey";
```
In React, run D3 inside `useEffect` and select via a `useRef` node, or let React own the DOM and use D3 only for scales/shape generators. See `references/interactivity.md`.

## The universal scaffold

Every gallery chart shares this skeleton. Internalize it; it is the backbone of everything else.

```js
// 1. Dimensions and margins (the "margin convention")
const margin = {top: 30, right: 30, bottom: 40, left: 50};
const width  = 640 - margin.left - margin.right;
const height = 400 - margin.top  - margin.bottom;

// 2. Append the SVG object to the container, then a <g> shifted by the margins
const svg = d3.select("#my_dataviz")
  .append("svg")
    .attr("width",  width  + margin.left + margin.right)
    .attr("height", height + margin.top  + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// 3. Load data (async). d3.csv / d3.json return Promises in v5+.
const data = await d3.csv("data.csv", d3.autoType);

// 4. Scales -> 5. Axes -> 6. Marks -> 7. Interactivity (see per-chart references)
```

Key v7 truths to keep straight:
- `d3.csv/json/tsv` return **Promises**; use `await` or `.then`. The old callback signature is gone.
- `d3.autoType` coerces numbers/dates automatically — pass it as the row accessor.
- Scales: `d3.scaleLinear`, `scaleBand`, `scaleTime`, `scaleOrdinal`, `scaleSqrt` (for bubble radius — area, not radius, encodes value), `scaleSequential` (+ `d3.interpolateViridis` etc.) for continuous color.
- Axes: `svg.append("g").call(d3.axisBottom(x))`; move the x-axis with `.attr("transform", translate(0,${height}))`.
- Data join (v7): `selection.join("rect")` is the modern replacement for the explicit `enter/append/exit/remove` dance. Use the `.join(enter, update, exit)` form for transitions.

## Routing — read the reference for the chart family

Do **not** free-recall full chart code. Open the matching reference file, adapt the pattern, then customize. Each reference is a compact table-of-contents + working v7 snippets.

| User wants… | Reference file |
|---|---|
| Barplot (basic/horizontal/ordered/grouped/stacked/%), lollipop, circular barplot, radar/spider, parallel coords, wordcloud | `references/ranking.md` |
| Scatter, bubble, connected scatter, heatmap, correlogram, 2D density | `references/correlation.md` |
| Histogram, density, violin, boxplot, ridgeline | `references/distribution.md` |
| Line, area, stacked area, streamgraph | `references/evolution.md` |
| Pie, donut, treemap, dendrogram, circular packing, sunburst, icicle | `references/partofwhole.md` |
| Background map, choropleth, bubble map, hexbin map, cartogram, connection map (projections, GeoJSON/TopoJSON) | `references/maps.md` |
| Chord diagram, network / force-directed graph, sankey, arc diagram, hierarchical edge bundling | `references/flow.md` |
| Scales, axes, color, data loading, formatting, the margin convention, version migration | `references/core.md` |
| Tooltips, hover highlight, transitions, buttons, update patterns, zoom, brush, dropdown filters, React/Svelte integration | `references/interactivity.md` |

Several references often apply to one request (e.g. a choropleth with a tooltip → `maps.md` + `interactivity.md`). Read all that are relevant.

## Working method

1. Confirm target + version + data shape (wide vs long/tidy matters — many gallery examples reshape with `d3.group`, `d3.rollup`, or `d3.stack`).
2. Read the relevant reference file(s).
3. Build with the margin-convention scaffold; wire scales → axes → marks → interactivity.
4. For a standalone deliverable, produce a **single self-contained `.html`** (D3 from CDN, embedded or inline-loaded data) so it runs by double-clicking. Save to `/mnt/user-data/outputs` and present it.
5. Use domain-accurate terms and keep the code clean and commented at decision points, not line-by-line.

## Data-shape helpers worth remembering

- `d3.group(data, d => d.key)` / `d3.rollup(data, reduce, d => d.key)` — replace nested `d3.nest` (removed).
- `d3.stack().keys([...])(data)` — for stacked bar / area / streamgraph. Add `.offset(d3.stackOffsetWiggle)` + `.order(d3.stackOrderInsideOut)` for streamgraphs.
- `d3.bin()` — histogram binning (replaces `d3.histogram`).
- `d3.hierarchy(root).sum(...).sort(...)` — feeds `d3.treemap`, `d3.pack`, `d3.tree`/`d3.cluster`, `d3.partition`.
- `d3.pie()`, `d3.arc()` — pie/donut geometry.
- `d3.line()`, `d3.area()`, `d3.curveBasis`/`curveMonotoneX` — path generators.