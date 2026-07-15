# Correlation charts

Scatter · Bubble · Connected scatter · Heatmap · Correlogram · 2D density

Assumes the `core.md` scaffold.

## Scatterplot

```js
const x = d3.scaleLinear().domain(d3.extent(data, d => d.x)).nice().range([0, width]);
const y = d3.scaleLinear().domain(d3.extent(data, d => d.y)).nice().range([height, 0]);

svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
svg.append("g").call(d3.axisLeft(y));

svg.append("g").selectAll("circle").data(data).join("circle")
    .attr("cx", d => x(d.x))
    .attr("cy", d => y(d.y))
    .attr("r", 4)
    .style("fill", "#69b3a2").style("opacity", 0.7);
```
Add zoom for dense clouds (see `interactivity.md` → zoom). Color by category with `d3.scaleOrdinal`.

## Bubble chart

Scatter with a third variable mapped to **area** (radius via `scaleSqrt`) and optionally a fourth to color.
```js
const z = d3.scaleSqrt().domain([0, d3.max(data, d => d.size)]).range([2, 40]);
const color = d3.scaleOrdinal().domain(groups).range(d3.schemeSet2);

svg.append("g").selectAll("circle").data(data).join("circle")
    .attr("cx", d => x(d.x)).attr("cy", d => y(d.y))
    .attr("r", d => z(d.size))
    .style("fill", d => color(d.group)).style("opacity", 0.7)
    .attr("stroke", "black");
```
Never map value to raw radius — it exaggerates by the square. Add a size legend.

## Connected scatter

Scatter whose points are joined in data order by a line (time series in x-y space).
```js
data.sort((a, b) => d3.ascending(a.order, b.order));
svg.append("path").datum(data)
  .attr("fill","none").attr("stroke","#69b3a2").attr("stroke-width",1.5)
  .attr("d", d3.line().x(d => x(d.x)).y(d => y(d.y)));
svg.append("g").selectAll("circle").data(data).join("circle")
  .attr("cx", d => x(d.x)).attr("cy", d => y(d.y)).attr("r", 4).attr("fill","#69b3a2");
```

## Heatmap

Grid of colored `rect`s: two categorical axes + a color-encoded value.
```js
const xVars = [...new Set(data.map(d => d.x))];
const yVars = [...new Set(data.map(d => d.y))];
const x = d3.scaleBand().domain(xVars).range([0, width]).padding(0.05);
const y = d3.scaleBand().domain(yVars).range([height, 0]).padding(0.05);
const color = d3.scaleSequential(d3.interpolateInferno)
  .domain(d3.extent(data, d => d.value));

svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickSize(0));
svg.append("g").call(d3.axisLeft(y).tickSize(0));

svg.selectAll("rect").data(data).join("rect")
    .attr("x", d => x(d.x)).attr("y", d => y(d.y))
    .attr("width", x.bandwidth()).attr("height", y.bandwidth())
    .style("fill", d => color(d.value));
```
For a color legend, draw a gradient `<rect>` or a row of quantized swatches.

## Correlogram

Small-multiples matrix of scatterplots (each variable pair), diagonal often a distribution/label. Build an N×N grid of sub-plots:
```js
const vars = numericColumns;
const size = width / vars.length;
vars.forEach((cx, i) => vars.forEach((cy, j) => {
  const cell = svg.append("g").attr("transform", `translate(${i*size},${j*size})`);
  if (i === j) {
    cell.append("text").attr("x", size/2).attr("y", size/2)
      .attr("text-anchor","middle").text(cx);
  } else {
    const xs = d3.scaleLinear().domain(d3.extent(data, d => +d[cx])).range([5, size-5]);
    const ys = d3.scaleLinear().domain(d3.extent(data, d => +d[cy])).range([size-5, 5]);
    cell.selectAll("circle").data(data).join("circle")
      .attr("cx", d => xs(+d[cx])).attr("cy", d => ys(+d[cy])).attr("r", 2).attr("fill","#69b3a2");
  }
}));
```
A numeric correlogram instead colors each cell by Pearson r — compute with a small helper and color via `scaleDiverging(interpolateRdBu)`.

## 2D density (contours)

Uses `d3.contourDensity` for heatmap-style density of a point cloud.
```js
const density = d3.contourDensity()
  .x(d => x(d.x)).y(d => y(d.y))
  .size([width, height])
  .bandwidth(20)(data);
const color = d3.scaleSequential(d3.interpolateYlGnBu).domain([0, d3.max(density, d => d.value)]);

svg.insert("g","g").selectAll("path").data(density).join("path")
  .attr("d", d3.geoPath())
  .attr("fill", d => color(d.value));
```
For a binned (rectangular) 2D histogram, aggregate into cells with `d3.rollup` and draw `rect`s colored by count.