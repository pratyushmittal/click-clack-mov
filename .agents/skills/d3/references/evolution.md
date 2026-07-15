# Evolution charts

Line · Multi-line · Area · Stacked area · Streamgraph

Assumes the `core.md` scaffold. Time series usually parse dates with `d3.scaleTime` + `d3.timeParse`.

## Line chart

```js
const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, width]);
const y = d3.scaleLinear().domain([0, d3.max(data, d => d.value)]).nice().range([height, 0]);

svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
svg.append("g").call(d3.axisLeft(y));

svg.append("path").datum(data)
  .attr("fill","none").attr("stroke","#69b3a2").attr("stroke-width",1.5)
  .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.value)));
```
Smooth with `.curve(d3.curveMonotoneX)` (preserves monotonicity — safer than `curveBasis`, which leaves the data points).

## Multi-line (one path per group)

```js
const grouped = d3.group(data, d => d.name);   // Map<name, rows[]>
const color = d3.scaleOrdinal().domain([...grouped.keys()]).range(d3.schemeTableau10);
const line = d3.line().x(d => x(d.date)).y(d => y(d.value));

svg.selectAll("path.series").data(grouped).join("path")
  .attr("class","series").attr("fill","none").attr("stroke-width",1.5)
  .attr("stroke", ([name]) => color(name))
  .attr("d", ([, rows]) => line(rows));
```
For legibility with many series, consider hover-to-highlight (dim others) — see `interactivity.md`.

## Area chart

```js
svg.append("path").datum(data)
  .attr("fill","#cce5df").attr("stroke","#69b3a2").attr("stroke-width",1.5)
  .attr("d", d3.area().x(d => x(d.date)).y0(y(0)).y1(d => y(d.value)));
```

## Stacked area

```js
const keys = seriesNames;
const stackedData = d3.stack().keys(keys)(data);   // data rows are wide: {date, a, b, c}
const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, width]);
const y = d3.scaleLinear()
  .domain([0, d3.max(stackedData, s => d3.max(s, d => d[1]))]).range([height, 0]);
const color = d3.scaleOrdinal().domain(keys).range(d3.schemeSet2);

svg.selectAll("path.layer").data(stackedData).join("path")
  .attr("class","layer").attr("fill", d => color(d.key))
  .attr("d", d3.area()
    .x(d => x(d.data.date))
    .y0(d => y(d[0])).y1(d => y(d[1])));
```
**Percent stacked area**: add `.offset(d3.stackOffsetExpand)` and format y as `%`.

## Streamgraph

A stacked area with a wiggly centered baseline — visually a "flowing" stack.
```js
const stackedData = d3.stack()
  .keys(keys)
  .offset(d3.stackOffsetWiggle)          // centered, minimum-wiggle baseline
  .order(d3.stackOrderInsideOut)         // largest series toward the center
  (data);

const y = d3.scaleLinear()
  .domain([d3.min(stackedData, s => d3.min(s, d => d[0])),
           d3.max(stackedData, s => d3.max(s, d => d[1]))])
  .range([height, 0]);

svg.selectAll("path.stream").data(stackedData).join("path")
  .attr("class","stream").attr("fill", d => color(d.key))
  .attr("d", d3.area().curve(d3.curveBasis)
    .x(d => x(d.data.date)).y0(d => y(d[0])).y1(d => y(d[1])));
```
Streamgraphs read trends well but hide absolute values — pair with a tooltip. Often the numeric y-axis is dropped as meaningless once centered.