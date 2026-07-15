# Part-of-a-whole charts

Pie · Donut · Treemap · Dendrogram/Tree · Circular packing · Sunburst · Icicle

Most of these are **hierarchy layouts**: build a root with `d3.hierarchy(data).sum(d => d.value).sort(...)`, then apply a layout that writes coordinates onto each node.

## Pie & Donut

```js
const radius = Math.min(width, height) / 2;
const g = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);
const color = d3.scaleOrdinal().domain(data.map(d => d.name)).range(d3.schemeSet2);

const pie = d3.pie().value(d => d.value).sort(null);
const arcs = pie(data);
const arc = d3.arc().innerRadius(0).outerRadius(radius);          // donut: innerRadius(radius*0.5)

g.selectAll("path").data(arcs).join("path")
  .attr("d", arc).attr("fill", d => color(d.data.name))
  .attr("stroke","white").style("stroke-width",2);

// labels
const labelArc = d3.arc().innerRadius(radius*0.7).outerRadius(radius*0.7);
g.selectAll("text").data(arcs).join("text")
  .attr("transform", d => `translate(${labelArc.centroid(d)})`)
  .attr("text-anchor","middle").text(d => d.data.name);
```
Prefer bar/lollipop over pie when comparing >3 slices — pies are hard to read; mention this if relevant.

## Treemap

```js
const root = d3.hierarchy(data).sum(d => d.value).sort((a,b) => b.value - a.value);
d3.treemap().size([width, height]).paddingInner(2)(root);
const color = d3.scaleOrdinal().range(d3.schemeSet3);

const leaf = svg.selectAll("g").data(root.leaves()).join("g")
  .attr("transform", d => `translate(${d.x0},${d.y0})`);
leaf.append("rect")
  .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
  .attr("fill", d => color(d.parent.data.name));
leaf.append("text").attr("x",4).attr("y",14)
  .text(d => d.data.name).attr("font-size","10px").attr("fill","white");
```
`d3.treemapSquarify` (default), `treemapBinary`, `treemapResquarify` change tiling aesthetics.

## Circular packing (pack layout)

```js
const root = d3.hierarchy(data).sum(d => d.value).sort((a,b) => b.value - a.value);
d3.pack().size([width, height]).padding(3)(root);

svg.selectAll("circle").data(root.descendants()).join("circle")
  .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", d => d.r)
  .attr("fill", d => d.children ? "#eee" : "#69b3a2")
  .attr("stroke", d => d.children ? "#ccc" : "none");
```
For a flat (non-nested) packing of one level, wrap items under a synthetic root and draw only leaves. Add zoomable pack for deep trees (focus + transition to a clicked node).

## Dendrogram / Tree

```js
const root = d3.hierarchy(data);
d3.tree().size([height, width - 100])(root);     // [height,width] → horizontal tree
// (use d3.cluster() instead of d3.tree() to align all leaves at the same depth)

const g = svg.append("g").attr("transform","translate(40,0)");
g.selectAll("path.link").data(root.links()).join("path")
  .attr("class","link").attr("fill","none").attr("stroke","#ccc")
  .attr("d", d3.linkHorizontal().x(d => d.y).y(d => d.x));  // note x/y swap for horizontal
g.selectAll("g.node").data(root.descendants()).join("g")
  .attr("transform", d => `translate(${d.y},${d.x})`)
  .call(sel => { sel.append("circle").attr("r",3).attr("fill","#69b3a2");
                 sel.append("text").attr("dy",3).attr("x", d => d.children ? -8 : 8)
                    .style("text-anchor", d => d.children ? "end" : "start").text(d => d.data.name); });
```

## Sunburst (radial partition)

```js
const radius = Math.min(width, height) / 2;
const root = d3.hierarchy(data).sum(d => d.value).sort((a,b)=>b.value-a.value);
d3.partition().size([2 * Math.PI, radius])(root);
const arc = d3.arc()
  .startAngle(d => d.x0).endAngle(d => d.x1)
  .innerRadius(d => d.y0).outerRadius(d => d.y1);
const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, root.children.length + 1));

svg.append("g").attr("transform", `translate(${width/2},${height/2})`)
  .selectAll("path").data(root.descendants().filter(d => d.depth)).join("path")
    .attr("d", arc)
    .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); });
```

## Icicle (rectangular partition)

Same `d3.partition()` but map `x0..x1` to width and `y0..y1` to depth-bands as rects:
```js
d3.partition().size([width, height])(root);
svg.selectAll("rect").data(root.descendants()).join("rect")
  .attr("x", d => d.x0).attr("y", d => d.y0)
  .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
  .attr("fill", d => color((d.children ? d : d.parent).data.name)).attr("stroke","#fff");
```

### Building hierarchy from flat data
If input is a flat edge list, use `d3.stratify().id(d => d.name).parentId(d => d.parent)(rows)` to construct the root before applying any layout.