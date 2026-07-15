# Distribution charts

Histogram · Density · Violin · Boxplot · Ridgeline

Assumes the `core.md` scaffold.

## Histogram

```js
const x = d3.scaleLinear().domain(d3.extent(data, d => d.value)).nice().range([0, width]);
const bins = d3.bin().domain(x.domain()).thresholds(x.ticks(40))(data.map(d => d.value));
const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).range([height, 0]);

svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
svg.append("g").call(d3.axisLeft(y));

svg.selectAll("rect").data(bins).join("rect")
    .attr("x", b => x(b.x0) + 1)
    .attr("y", b => y(b.length))
    .attr("width", b => Math.max(0, x(b.x1) - x(b.x0) - 1))
    .attr("height", b => height - y(b.length))
    .style("fill", "#69b3a2");
```
`thresholds` accepts a count, an array of edges, or a function. Tune bin count to reveal shape without noise.

## Kernel density estimate (density plot)

D3 has no built-in KDE; implement Epanechnikov (gallery's approach):
```js
function kernelDensityEstimator(kernel, X) {
  return V => X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
}
function kernelEpanechnikov(k) {
  return v => (Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0);
}
const x = d3.scaleLinear().domain(d3.extent(data, d => d.value)).nice().range([0, width]);
const kde = kernelDensityEstimator(kernelEpanechnikov(7), x.ticks(60));
const density = kde(data.map(d => d.value));
const y = d3.scaleLinear().domain([0, d3.max(density, d => d[1])]).range([height, 0]);

svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
svg.append("g").call(d3.axisLeft(y));
svg.append("path").datum(density)
  .attr("fill","#69b3a2").attr("opacity",0.4).attr("stroke","#000")
  .attr("d", d3.line().curve(d3.curveBasis).x(d => x(d[0])).y(d => y(d[1])));
```
Bandwidth (the `7`) controls smoothness — larger is smoother. Overlay multiple densities for group comparison.

## Violin plot

Per-group KDE mirrored around a category position. Compute a density per group, scale its width, and draw with `d3.area`.
```js
const groups = [...new Set(data.map(d => d.group))];
const x = d3.scaleBand().domain(groups).range([0, width]).padding(0.05);
const y = d3.scaleLinear().domain(d3.extent(data, d => d.value)).nice().range([height, 0]);
svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
svg.append("g").call(d3.axisLeft(y));

const kde = kernelDensityEstimator(kernelEpanechnikov(0.2), y.ticks(50)); // reuse helpers from density section
const perGroup = d3.rollup(data, v => kde(v.map(d => d.value)), d => d.group);

const maxWidth = d3.max([...perGroup.values()], dens => d3.max(dens, d => d[1]));
const xNum = d3.scaleLinear().domain([-maxWidth, maxWidth]).range([0, x.bandwidth()]);

svg.selectAll("myViolin").data(perGroup).join("g")
  .attr("transform", ([g]) => `translate(${x(g)},0)`)
  .append("path").datum(([, dens]) => dens)
    .attr("fill","#69b3a2").attr("stroke","none")
    .attr("d", d3.area()
      .x0(d => xNum(-d[1])).x1(d => xNum(d[1]))
      .y(d => y(d[0])).curve(d3.curveCatmullRom));
```

## Boxplot

Per group compute q1/median/q3, IQR whiskers, then draw line + box + median + caps.
```js
const groups = [...new Set(data.map(d => d.group))];
const stats = d3.rollup(data, v => {
  const s = v.map(d => d.value).sort(d3.ascending);
  const q1 = d3.quantile(s, .25), med = d3.quantile(s, .5), q3 = d3.quantile(s, .75);
  const iqr = q3 - q1;
  return {q1, med, q3, min: Math.max(d3.min(s), q1 - 1.5*iqr), max: Math.min(d3.max(s), q3 + 1.5*iqr)};
}, d => d.group);

const x = d3.scaleBand().domain(groups).range([0, width]).padding(0.4);
const y = d3.scaleLinear().domain(d3.extent(data, d => d.value)).nice().range([height, 0]);
svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
svg.append("g").call(d3.axisLeft(y));

// vertical whisker line
svg.selectAll("vertLine").data(stats).join("line")
  .attr("x1", ([g]) => x(g)+x.bandwidth()/2).attr("x2", ([g]) => x(g)+x.bandwidth()/2)
  .attr("y1", ([,s]) => y(s.min)).attr("y2", ([,s]) => y(s.max)).attr("stroke","black");
// box
svg.selectAll("box").data(stats).join("rect")
  .attr("x", ([g]) => x(g)).attr("y", ([,s]) => y(s.q3))
  .attr("width", x.bandwidth()).attr("height", ([,s]) => y(s.q1) - y(s.q3))
  .attr("stroke","black").attr("fill","#69b3a2");
// median
svg.selectAll("median").data(stats).join("line")
  .attr("x1", ([g]) => x(g)).attr("x2", ([g]) => x(g)+x.bandwidth())
  .attr("y1", ([,s]) => y(s.med)).attr("y2", ([,s]) => y(s.med)).attr("stroke","black");
```
Overlay jittered points for small n to avoid hiding the raw distribution.

## Ridgeline

Stacked, slightly-overlapping density curves — one row per group, sharing an x-axis. Compute a KDE per group, give each its own baseline (`scalePoint` for group position), allow overlap by scaling density height beyond the row gap.
```js
const groups = [...];                            // ordered categories
const x = d3.scaleLinear().domain(xExtent).range([0, width]);
const yName = d3.scalePoint().domain(groups).range([0, height]).padding(1);
const kde = kernelDensityEstimator(kernelEpanechnikov(bw), x.ticks(60));
const overlap = 60;                              // vertical stretch → overlap between ridges

groups.forEach(g => {
  const dens = kde(data.filter(d => d.group === g).map(d => d.value));
  const yLocal = d3.scaleLinear().domain([0, d3.max(dens, d => d[1])]).range([0, -overlap]);
  svg.append("path").datum(dens)
    .attr("transform", `translate(0,${yName(g)})`)
    .attr("fill","#69b3a2").attr("opacity",0.7).attr("stroke","black")
    .attr("d", d3.area().curve(d3.curveBasis)
      .x(d => x(d[0])).y0(0).y1(d => yLocal(d[1])));
});
```