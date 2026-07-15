# Flow charts

Chord diagram · Network (force-directed) · Sankey · Arc diagram · Hierarchical edge bundling

## Network / force-directed graph

Input: `{nodes: [{id}], links: [{source, target}]}`. `d3.forceSimulation` positions nodes; update on each tick.
```js
const link = svg.append("g").attr("stroke","#aaa").selectAll("line")
  .data(links).join("line").attr("stroke-width", d => Math.sqrt(d.value ?? 1));
const node = svg.append("g").selectAll("circle")
  .data(nodes).join("circle").attr("r", 6).attr("fill","#69b3a2")
  .call(drag(simulation));

const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id(d => d.id).distance(40))
  .force("charge", d3.forceManyBody().strength(-120))
  .force("center", d3.forceCenter(width/2, height/2))
  .on("tick", () => {
    link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    node.attr("cx", d => d.x).attr("cy", d => d.y);
  });

function drag(sim){
  return d3.drag()
    .on("start", (e,d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
    .on("drag",  (e,d) => { d.fx=e.x; d.fy=e.y; })
    .on("end",   (e,d) => { if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; });
}
```
`forceLink.id()` resolves string ids to node objects — d3 mutates `links` so `source`/`target` become node refs. Add `forceCollide` to prevent overlap; `forceX/forceY` to cluster.

## Sankey (needs d3-sankey)

```html
<script src="https://cdn.jsdelivr.net/npm/d3-sankey@0.12"></script>
```
```js
const sankey = d3.sankey()
  .nodeId(d => d.name).nodeWidth(15).nodePadding(12)
  .extent([[1,1],[width-1,height-6]]);
const {nodes, links} = sankey({
  nodes: graph.nodes.map(d => ({...d})),
  links: graph.links.map(d => ({...d}))
});
const color = d3.scaleOrdinal(d3.schemeCategory10);

svg.append("g").selectAll("rect").data(nodes).join("rect")     // node rects
  .attr("x", d => d.x0).attr("y", d => d.y0)
  .attr("height", d => d.y1 - d.y0).attr("width", d => d.x1 - d.x0)
  .attr("fill", d => color(d.name));

svg.append("g").attr("fill","none").selectAll("path").data(links).join("path")  // ribbons
  .attr("d", d3.sankeyLinkHorizontal())
  .attr("stroke", d => color(d.source.name))
  .attr("stroke-width", d => Math.max(1, d.width))
  .attr("stroke-opacity", 0.4);

svg.append("g").selectAll("text").data(nodes).join("text")
  .attr("x", d => d.x0 < width/2 ? d.x1 + 6 : d.x0 - 6)
  .attr("y", d => (d.y0 + d.y1)/2).attr("dy","0.35em")
  .attr("text-anchor", d => d.x0 < width/2 ? "start" : "end").text(d => d.name);
```
Always spread-copy nodes/links (`{...d}`) — d3-sankey mutates them, and reusing the originals breaks re-runs. `d3.sankeyLeft/Right/Center/Justify` control node alignment.

## Chord diagram

Relationships as a square matrix; ribbons between arc groups around a circle.
```js
const radius = Math.min(width, height)/2 - 20;
const g = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);
const chord = d3.chord().padAngle(0.05).sortSubgroups(d3.descending)(matrix);
const arc = d3.arc().innerRadius(radius).outerRadius(radius + 12);
const ribbon = d3.ribbon().radius(radius);
const color = d3.scaleOrdinal(d3.schemeSet2);

g.append("g").selectAll("path").data(chord.groups).join("path")   // outer arcs
  .attr("d", arc).attr("fill", d => color(d.index)).attr("stroke","#fff");
g.append("g").attr("fill-opacity",0.7).selectAll("path").data(chord).join("path") // ribbons
  .attr("d", ribbon).attr("fill", d => color(d.source.index)).attr("stroke","#fff");
```
Build the `matrix` (N×N flows) from your data first — rows = source, cols = target.

## Arc diagram

Nodes on a line; connections as semicircular arcs above (or below) it.
```js
const x = d3.scalePoint().domain(nodes.map(d => d.id)).range([0, width]);
svg.selectAll("path.arc").data(links).join("path")
  .attr("class","arc").attr("fill","none").attr("stroke","#69b3a2")
  .attr("d", d => {
    const start = x(d.source), end = x(d.target);
    const r = Math.abs(end - start) / 2;
    return `M ${start} ${height/2} A ${r} ${r} 0 0 ${start < end ? 1 : 0} ${end} ${height/2}`;
  });
svg.selectAll("circle").data(nodes).join("circle")
  .attr("cx", d => x(d.id)).attr("cy", height/2).attr("r", 4).attr("fill","#69b3a2");
```
Ordering nodes (e.g. by cluster) drastically reduces arc crossings.

## Hierarchical edge bundling

Nodes on a circle (leaves of a hierarchy); links bundled along the tree structure with `d3.curveBundle`.
```js
const radius = Math.min(width, height)/2 - 60;
const root = d3.hierarchy(dataHierarchy);
d3.cluster().size([2 * Math.PI, radius])(root);
const g = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);

const line = d3.lineRadial().curve(d3.curveBundle.beta(0.85))
  .radius(d => d.y).angle(d => d.x);

// build links from an id/imports relation, then draw paths through each node's ancestry path
g.append("g").attr("fill","none").attr("stroke","#69b3a2").attr("stroke-opacity",0.4)
  .selectAll("path").data(bundledLinks).join("path")   // each: node.path(targetNode)
    .attr("d", d => line(d.source.path(d.target)));

g.selectAll("text").data(root.leaves()).join("text")   // radial leaf labels
  .attr("transform", d => `rotate(${d.x*180/Math.PI - 90}) translate(${d.y+6},0)${d.x>=Math.PI?"rotate(180)":""}`)
  .attr("text-anchor", d => d.x >= Math.PI ? "end" : "start").text(d => d.data.name);
```
`beta` (0–1) controls bundling tightness — lower = more bundled. `node.path(otherNode)` returns the least-common-ancestor route used as control points.