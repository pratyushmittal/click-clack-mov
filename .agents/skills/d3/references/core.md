# Core: scaffold, scales, axes, color, data, migration

Contents: [Margin convention](#margin) · [Loading data](#data) · [Scales](#scales) · [Axes](#axes) · [Color](#color) · [Formatting](#format) · [Data reshaping](#reshape) · [Version migration](#migration)

<a name="margin"></a>
## Margin convention (the backbone)

```js
const margin = {top: 30, right: 30, bottom: 40, left: 50};
const width  = 640 - margin.left - margin.right;
const height = 400 - margin.top  - margin.bottom;

const svg = d3.select("#my_dataviz")
  .append("svg")
    .attr("width",  width  + margin.left + margin.right)
    .attr("height", height + margin.top  + margin.bottom)
    .attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom]) // responsive
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
```
All chart drawing happens inside this `<g>`; its origin is the top-left of the plotting area.

<a name="data"></a>
## Loading data (v5+ is Promise-based)

```js
const data = await d3.csv("file.csv", d3.autoType);          // autoType coerces numbers & ISO dates
const data = await d3.json("file.json");
const [a, b] = await Promise.all([d3.csv("a.csv"), d3.json("b.json")]); // parallel loads

// Custom row accessor (when autoType isn't enough):
const data = await d3.csv("file.csv", d => ({
  date: d3.timeParse("%Y-%m-%d")(d.date),
  value: +d.value
}));
```
Inline data (self-contained HTML) — just declare a JS array/object literal; no loader needed.

<a name="scales"></a>
## Scales

```js
// Continuous position
const x = d3.scaleLinear().domain([0, d3.max(data, d => d.x)]).range([0, width]);
const y = d3.scaleLinear().domain([0, d3.max(data, d => d.y)]).range([height, 0]); // note inverted range

// Time
const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, width]);

// Categorical / bars
const x = d3.scaleBand().domain(data.map(d => d.group)).range([0, width]).padding(0.2);

// Ordinal color
const color = d3.scaleOrdinal().domain(groups).range(d3.schemeTableau10);

// Bubble radius — encode value by AREA, so scaleSqrt (never scaleLinear on r)
const r = d3.scaleSqrt().domain([0, d3.max(data, d => d.size)]).range([2, 40]);

// Sequential (continuous color)
const color = d3.scaleSequential(d3.interpolateViridis).domain([0, maxVal]);

// Diverging
const color = d3.scaleDiverging(d3.interpolateRdBu).domain([min, 0, max]);
```
`.nice()` rounds a continuous domain to human-friendly bounds. `.clamp(true)` prevents out-of-range spill.

<a name="axes"></a>
## Axes

```js
// X axis at the bottom
svg.append("g")
  .attr("transform", `translate(0,${height})`)
  .call(d3.axisBottom(x));

// Y axis
svg.append("g").call(d3.axisLeft(y));

// Tick control
d3.axisBottom(x).ticks(5).tickFormat(d3.format(".0%"));
d3.axisBottom(x).tickValues([0, 25, 50, 75, 100]).tickSizeOuter(0);

// Rotate long category labels
svg.append("g").attr("transform", `translate(0,${height})`)
  .call(d3.axisBottom(x))
  .selectAll("text")
    .attr("transform", "translate(-10,0)rotate(-45)")
    .style("text-anchor", "end");

// Gridlines: an axis with long inward ticks and no labels
svg.append("g")
  .attr("class", "grid")
  .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
  .selectAll("line").attr("stroke", "#e0e0e0");
```

<a name="color"></a>
## Color

- Categorical schemes: `d3.schemeCategory10`, `schemeTableau10`, `schemeSet2`, `schemePaired`, `schemeDark2`.
- Sequential interpolators: `d3.interpolateViridis`, `interpolateBlues`, `interpolateInferno`, `interpolateYlGnBu`, `interpolateTurbo`.
- Diverging: `interpolateRdBu`, `interpolateBrBG`, `interpolateSpectral`.
- Quantized scale (discrete bins from a continuous scheme): `d3.scaleQuantize().domain([min,max]).range(d3.schemeBlues[7])`.
- Threshold scale (choropleth breaks): `d3.scaleThreshold().domain([1,10,100,1000]).range(d3.schemeBlues[5])`.

<a name="format"></a>
## Number & time formatting

```js
d3.format(",")(1234567);      // "1,234,567"
d3.format(".1%")(0.123);      // "12.3%"
d3.format("$,.2f")(1234.5);   // "$1,234.50"
d3.format(".2s")(42000);      // "42k"
const fmt = d3.timeFormat("%b %Y");        // "Jan 2024"
const parse = d3.timeParse("%Y-%m-%d");
```

<a name="reshape"></a>
## Data reshaping (replaces removed d3.nest)

```js
// Group -> Map<key, rows[]>
const grouped = d3.group(data, d => d.category);
// Rollup -> Map<key, aggregate>
const totals = d3.rollup(data, v => d3.sum(v, d => d.value), d => d.category);
// Multi-level
const nested = d3.rollup(data, v => v.length, d => d.year, d => d.type);
// Iterate a Map in a join
[...grouped].forEach(([key, rows]) => { /* ... */ });

// Wide -> stacked series
const keys = ["a", "b", "c"];
const series = d3.stack().keys(keys)(data); // each series: array of [y0, y1] per row

// Binning for histograms
const bins = d3.bin().domain(x.domain()).thresholds(x.ticks(40))(data.map(d => d.value));

// Summary stats (boxplot/violin)
const q1 = d3.quantile(sorted, 0.25), median = d3.quantile(sorted, 0.5), q3 = d3.quantile(sorted, 0.75);
const mean = d3.mean(v), dev = d3.deviation(v), ext = d3.extent(v);
```

<a name="migration"></a>
## Version migration gotchas (why old snippets break)

- **v3→v4**: namespaces flattened (`d3.scale.linear` → `d3.scaleLinear`, `d3.svg.axis` → `d3.axisBottom`). `d3.layout.*` → top-level (`d3.layout.pie` → `d3.pie`).
- **v4→v5**: loaders returned Promises instead of taking callbacks. `d3.queue` → `Promise.all`.
- **v5→v6/7**: event handlers now receive `(event, d)` — the `event` is the **first** arg, no more `d3.event`. Use `d3.pointer(event, node)` instead of `d3.mouse`. `d3.nest()` removed → `d3.group`/`d3.rollup`. `d3.histogram` → `d3.bin`. `selection.join()` introduced as the ergonomic data-join.
- Event handler shape in v7:
  ```js
  .on("mouseover", (event, d) => { const [mx, my] = d3.pointer(event); /* d is datum */ });
  ```