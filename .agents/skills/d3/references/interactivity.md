# Interactivity & integration

Tooltip · Hover highlight · Transitions · Update pattern (join) · Buttons · Dropdown filter · Zoom · Brush · React/Svelte

**v7 event signature**: handlers get `(event, d)`. Use `d3.pointer(event, node)` for coordinates. There is no `d3.event`.

## Tooltip (HTML div — most flexible)

```html
<style>
  #tooltip { position:absolute; opacity:0; background:#fff; border:1px solid #ccc;
             border-radius:4px; padding:6px 8px; font:12px sans-serif; pointer-events:none; }
</style>
<div id="tooltip"></div>
```
```js
const tooltip = d3.select("#tooltip");
marks
  .on("mouseover", (event, d) => tooltip.style("opacity", 1))
  .on("mousemove", (event, d) => tooltip
      .html(`<b>${d.name}</b><br>${d.value}`)
      .style("left", (event.pageX + 12) + "px")
      .style("top",  (event.pageY - 20) + "px"))
  .on("mouseleave", () => tooltip.style("opacity", 0));
```
`pointer-events:none` on the tooltip prevents flicker. For SVG-only contexts, a `<text>`/`<g>` tooltip works but clips to the SVG bounds.

## Hover highlight (fade the rest)

```js
function highlight(event, d) {
  marks.style("opacity", 0.15);
  d3.selectAll("." + d.group).style("opacity", 1);   // give marks a class per group
}
function unhighlight() { marks.style("opacity", 1); }
marks.on("mouseover", highlight).on("mouseleave", unhighlight);
```

## Transitions

```js
d3.select(node).transition().duration(750).ease(d3.easeCubicOut)
  .attr("height", newH).attr("y", newY);
// staggered
bars.transition().duration(600).delay((d,i) => i * 40).attr("y", d => y(d.value));
```
Chain `.transition().transition()` for sequences. Use `.attrTween`/`.tween` for custom interpolators (e.g. animating arcs by interpolating angles).

## Update pattern with `.join`

The canonical way to move between datasets while animating enter/update/exit:
```js
function update(data) {
  x.domain(data.map(d => d.group));
  svg.select(".x-axis").transition().call(d3.axisBottom(x));

  svg.selectAll("rect").data(data, d => d.group).join(
    enter => enter.append("rect")
        .attr("x", d => x(d.group)).attr("y", height).attr("height", 0)
        .attr("width", x.bandwidth()).attr("fill","#69b3a2")
      .call(e => e.transition().duration(600)
        .attr("y", d => y(d.value)).attr("height", d => height - y(d.value))),
    update => update
      .call(u => u.transition().duration(600)
        .attr("x", d => x(d.group)).attr("y", d => y(d.value))
        .attr("width", x.bandwidth()).attr("height", d => height - y(d.value))),
    exit => exit
      .call(e => e.transition().duration(300).attr("y", height).attr("height", 0).remove())
  );
}
```
The **key function** `d => d.group` (second arg to `.data`) is what makes object constancy work — without it, updates rebind by index.

## Buttons (change color / data)

```js
d3.select("#btnColor").on("click", () => marks.transition().style("fill", "#e34a33"));
d3.select("#btnData1").on("click", () => update(dataset1));
d3.select("#btnData2").on("click", () => update(dataset2));
```

## Dropdown filter

```js
d3.select("#selectGroup").selectAll("option").data(groups).join("option")
  .text(d => d).attr("value", d => d);
d3.select("#selectGroup").on("change", function() {
  update(allData.filter(d => d.group === this.value));
});
```

## Zoom & pan

```js
const zoom = d3.zoom().scaleExtent([1, 12])
  .on("zoom", (event) => {
    plotArea.attr("transform", event.transform);         // transform a <g>, not the svg root
    // for scatter with axes: rescale and redraw axes instead of transforming marks:
    // const zx = event.transform.rescaleX(x); gx.call(d3.axisBottom(zx)); dots.attr("cx", d=>zx(d.x));
  });
svg.call(zoom);
```
For maps, apply `event.transform` to the map `<g>` and optionally adjust `stroke-width` by `1/k` to keep borders crisp.

## Brush (range selection)

```js
const brush = d3.brushX().extent([[0,0],[width,height]])
  .on("end", ({selection}) => {
    if (!selection) return;
    const [x0, x1] = selection.map(x.invert);
    update(data.filter(d => d.date >= x0 && d.date <= x1));
  });
svg.append("g").attr("class","brush").call(brush);
```
`d3.brush` (2D), `brushX`, `brushY`. Common in a focus+context (overview + detail) chart pair.

## React integration

Two idioms:
1. **D3 owns the DOM** — run inside `useEffect`, select a `useRef` node, clean up on unmount.
   ```jsx
   const ref = useRef();
   useEffect(() => {
     const svg = d3.select(ref.current);
     svg.selectAll("*").remove();        // clear before redraw
     /* ...build chart... */
   }, [data]);
   return <svg ref={ref} width={640} height={400} />;
   ```
2. **React owns the DOM, D3 does math** — use D3 only for scales/`d3.line`/`d3.arc`, and render `<rect>`/`<path>` as JSX from the computed values. Cleaner for declarative apps; preferred for static/lightly-interactive charts.

## Svelte integration

D3 scales/generators in the `<script>`, marks in markup via `{#each}`; bind a node with `bind:this` only when you need D3 to drive imperative behavior (axes via `use:` action, zoom, brush, force ticks).

## Responsiveness
Set `viewBox` + `preserveAspectRatio` on the SVG and size it with CSS (`width:100%`) so it scales without recomputing scales. For true reflow (re-binning on resize), listen to a `ResizeObserver` and re-run the draw.