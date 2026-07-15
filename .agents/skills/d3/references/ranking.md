# Ranking charts

Barplot (basic/horizontal/ordered) · Grouped bar · Stacked bar (+%) · Lollipop · Circular barplot · Radar/Spider · Parallel coordinates · Wordcloud

Assumes the margin-convention scaffold from `core.md` (variables `svg`, `width`, `height` in scope).

## Basic vertical barplot

```js
const x = d3.scaleBand().domain(data.map(d => d.group)).range([0, width]).padding(0.2);
const y = d3.scaleLinear().domain([0, d3.max(data, d => d.value)]).range([height, 0]);

svg.append("g").attr("transform", `translate(0,${height})`)
   .call(d3.axisBottom(x)).selectAll("text")
     .attr("transform", "translate(-10,0)rotate(-45)").style("text-anchor", "end");
svg.append("g").call(d3.axisLeft(y));

svg.selectAll("rect").data(data).join("rect")
    .attr("x", d => x(d.group))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.value))
    .attr("fill", "#69b3a2");
```

**Horizontal**: swap the scale types — `y` becomes `scaleBand`, `x` becomes `scaleLinear` — and set each rect's `x=0`, `y=y(d.group)`, `width=x(d.value)`, `height=y.bandwidth()`. Preferred when category labels are long.

**Ordered**: sort the domain before assigning, e.g. `data.sort((a,b) => d3.descending(a.value, b.value))` then rebuild `x.domain(...)`. Ordering makes rankings readable — always consider it.

**Load animation**: initialize bars at the baseline then transition:
```js
bars.attr("y", height).attr("height", 0)
  .transition().duration(800)
    .attr("y", d => y(d.value)).attr("height", d => height - y(d.value)).delay((d,i)=>i*80);
```

## Grouped barplot

```js
const subgroups = keys;                     // e.g. ["a","b","c"]
const groups = data.map(d => d.group);
const x  = d3.scaleBand().domain(groups).range([0, width]).padding(0.2);
const xSub = d3.scaleBand().domain(subgroups).range([0, x.bandwidth()]).padding(0.05);
const y  = d3.scaleLinear().domain([0, d3.max(data, d => d3.max(subgroups, k => +d[k]))]).range([height, 0]);
const color = d3.scaleOrdinal().domain(subgroups).range(d3.schemeSet2);

svg.append("g").selectAll("g").data(data).join("g")
    .attr("transform", d => `translate(${x(d.group)},0)`)
  .selectAll("rect")
  .data(d => subgroups.map(k => ({key: k, value: +d[k]}))).join("rect")
    .attr("x", d => xSub(d.key))
    .attr("y", d => y(d.value))
    .attr("width", xSub.bandwidth())
    .attr("height", d => height - y(d.value))
    .attr("fill", d => color(d.key));
```

## Stacked barplot

```js
const subgroups = keys;
const x = d3.scaleBand().domain(data.map(d => d.group)).range([0, width]).padding(0.2);
const stacked = d3.stack().keys(subgroups)(data);
const y = d3.scaleLinear()
  .domain([0, d3.max(stacked, s => d3.max(s, d => d[1]))]).range([height, 0]);
const color = d3.scaleOrdinal().domain(subgroups).range(d3.schemeSet2);

svg.append("g").selectAll("g").data(stacked).join("g")
    .attr("fill", d => color(d.key))
  .selectAll("rect")
  .data(d => d).join("rect")                 // d is one series; each element is [y0,y1] with .data
    .attr("x", d => x(d.data.group))
    .attr("y", d => y(d[1]))
    .attr("height", d => y(d[0]) - y(d[1]))
    .attr("width", x.bandwidth());
```
**Percent stacked**: add `.offset(d3.stackOffsetExpand)` to the stack generator and format the y-axis with `d3.format(".0%")`. Highlight-on-hover: dim all series then restore the hovered `.key` (see `interactivity.md`).

## Lollipop

Bar's minimalist cousin: a line to the value plus a circle head.
```js
svg.selectAll("myline").data(data).join("line")
    .attr("x1", d => x(d.group)).attr("x2", d => x(d.group))
    .attr("y1", d => y(d.value)).attr("y2", height).attr("stroke", "grey");
svg.selectAll("mycircle").data(data).join("circle")
    .attr("cx", d => x(d.group)).attr("cy", d => y(d.value)).attr("r", 5).attr("fill", "#69b3a2");
```
Use `scaleBand` (with `bandwidth/2` offset) or `scalePoint` for `x`.

## Circular barplot

```js
const innerRadius = 90, outerRadius = Math.min(width, height) / 2;
const g = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);
const x = d3.scaleBand().domain(data.map(d => d.name))
  .range([0, 2 * Math.PI]).align(0);
const y = d3.scaleRadial().domain([0, d3.max(data, d => d.value)]).range([innerRadius, outerRadius]);

g.selectAll("path").data(data).join("path")
  .attr("fill", "#69b3a2")
  .attr("d", d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(d => y(d.value))
    .startAngle(d => x(d.name))
    .endAngle(d => x(d.name) + x.bandwidth())
    .padAngle(0.01).padRadius(innerRadius));
```

## Radar / Spider

One axis per variable radiating from center; a closed path per series.
```js
const g = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);
const radius = Math.min(width, height) / 2 - 30;
const axes = features;                        // variable names
const angle = i => (Math.PI * 2 * i) / axes.length - Math.PI/2;
const r = d3.scaleLinear().domain([0, maxVal]).range([0, radius]);

// grid rings + spokes
[0.25,0.5,0.75,1].forEach(t => g.append("circle").attr("r", r.range()[1]*t)
  .attr("fill","none").attr("stroke","#ccc"));
axes.forEach((a,i)=> g.append("line")
  .attr("x2", r(maxVal)*Math.cos(angle(i))).attr("y2", r(maxVal)*Math.sin(angle(i)))
  .attr("stroke","#ccc"));

const lineRadial = d3.lineRadial()
  .angle((d,i) => angle(i) + Math.PI/2)         // lineRadial measures clockwise from 12 o'clock
  .radius(d => r(d));
g.append("path").datum(axes.map(a => series[a]))
  .attr("d", lineRadial).attr("fill","#69b3a2").attr("fill-opacity",0.4).attr("stroke","#69b3a2");
```
Radar is contentious for >2 series — mention `data-to-viz.com` caveats if the user stacks many.

## Parallel coordinates

One vertical axis per dimension; each row is a polyline crossing them.
```js
const dims = Object.keys(data[0]).filter(k => k !== "name");
const yByDim = {};
dims.forEach(dim => {
  yByDim[dim] = d3.scaleLinear().domain(d3.extent(data, d => +d[dim])).range([height, 0]);
});
const x = d3.scalePoint().domain(dims).range([0, width]);
const path = d => d3.line()(dims.map(p => [x(p), yByDim[p](d[p])]));

svg.selectAll("myPath").data(data).join("path")
  .attr("d", path).attr("fill","none").attr("stroke","#69b3a2").attr("opacity",0.5);

svg.selectAll("myAxis").data(dims).join("g")
  .attr("transform", d => `translate(${x(d)})`)
  .each(function(d){ d3.select(this).call(d3.axisLeft(yByDim[d])); })
  .append("text").attr("y",-9).attr("fill","black").style("text-anchor","middle").text(d=>d);
```

## Wordcloud (needs d3-cloud)

```html
<script src="https://cdn.jsdelivr.net/npm/d3-cloud@1"></script>
```
```js
const layout = d3.layout.cloud()
  .size([width, height])
  .words(words.map(d => ({text: d.word, size: d.freq})))
  .padding(5).rotate(() => (Math.random() < 0.5 ? 0 : 90))
  .fontSize(d => size(d.size))
  .on("end", draw);
layout.start();

function draw(words) {
  svg.append("g").attr("transform", `translate(${width/2},${height/2})`)
    .selectAll("text").data(words).join("text")
      .style("font-size", d => `${d.size}px`)
      .attr("text-anchor", "middle")
      .attr("transform", d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
      .text(d => d.text);
}
```
d3-cloud is asynchronous — always draw inside the `end` callback.