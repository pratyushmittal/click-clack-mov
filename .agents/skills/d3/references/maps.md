# Maps

Projections & paths · Background map · Choropleth · Bubble map · Hexbin map · Connection map · Cartogram

Maps hinge on three things: a **projection** (geo coords → pixels), a **path generator** (`d3.geoPath`), and **geometry** (GeoJSON, or TopoJSON decoded to GeoJSON).

## Data formats
- **GeoJSON**: verbose but native to D3. `svg.selectAll("path").data(geojson.features)`.
- **TopoJSON**: compact, encodes shared borders. Decode client-side:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/topojson-client@3"></script>
  ```
  ```js
  const topo = await d3.json("world.json");
  const geojson = topojson.feature(topo, topo.objects.countries); // → FeatureCollection
  const borders = topojson.mesh(topo, topo.objects.countries, (a,b) => a !== b); // interior borders
  ```

## Projection + path

```js
const projection = d3.geoMercator()                 // or geoNaturalEarth1, geoAlbersUsa, geoOrthographic…
  .fitSize([width, height], geojson);               // auto center+scale to fit the SVG
const path = d3.geoPath().projection(projection);
```
Common projections: `geoMercator` (web default; distorts poles), `geoNaturalEarth1` (world thematic), `geoAlbersUsa` (US with inset AK/HI), `geoOrthographic` (globe), `geoConicConformal` (regional). Use `.fitSize`/`.fitExtent` instead of hand-tuning `.scale`/`.center`.

## Background map (base layer)

```js
svg.append("g").selectAll("path").data(geojson.features).join("path")
  .attr("d", path)
  .attr("fill", "#cccccc").attr("stroke", "#ffffff").attr("stroke-width", 0.5);
```

## Choropleth

Join a data value per region, color by a scale keyed on a shared id.
```js
const valueById = new Map(rows.map(d => [d.code, +d.value]));
const color = d3.scaleThreshold()
  .domain([10, 100, 1000, 10000]).range(d3.schemeBlues[5]);   // or scaleSequential(interpolateBlues)

svg.append("g").selectAll("path").data(geojson.features).join("path")
  .attr("d", path)
  .attr("fill", d => { const v = valueById.get(d.id ?? d.properties.code); return v == null ? "#eee" : color(v); })
  .attr("stroke","#fff").attr("stroke-width",0.3);
```
Match the id field carefully (`d.id`, `d.properties.iso_a3`, etc.) — mismatched keys are the #1 choropleth bug. Add a discrete threshold legend.

## Bubble map

Base map + circles positioned by `projection([lon, lat])`, radius by `scaleSqrt`.
```js
const r = d3.scaleSqrt().domain([0, d3.max(places, d => d.size)]).range([1, 30]);
svg.append("g").selectAll("circle").data(places).join("circle")
  .attr("cx", d => projection([d.lon, d.lat])[0])
  .attr("cy", d => projection([d.lon, d.lat])[1])
  .attr("r", d => r(d.size))
  .attr("fill","#e34a33").attr("fill-opacity",0.6).attr("stroke","#b30000");
```

## Hexbin map (needs d3-hexbin)

Bin many points into hexagons over the projected plane.
```html
<script src="https://cdn.jsdelivr.net/npm/d3-hexbin@0.2"></script>
```
```js
const hexbin = d3.hexbin()
  .radius(10).extent([[0,0],[width,height]]);
const points = data.map(d => projection([d.lon, d.lat]));
const bins = hexbin(points);
const color = d3.scaleSequential(d3.interpolateViridis).domain([0, d3.max(bins, b => b.length)]);

svg.append("g").selectAll("path").data(bins).join("path")
  .attr("d", hexbin.hexagon())
  .attr("transform", d => `translate(${d.x},${d.y})`)
  .attr("fill", d => color(d.length)).attr("stroke","#fff");
```
Clip to the map outline for a clean edge.

## Connection map

Great-circle-ish links between coordinate pairs over a base map.
```js
svg.append("g").selectAll("path.route").data(routes).join("path")
  .attr("class","route").attr("fill","none").attr("stroke","#69b3a2").attr("stroke-width",1)
  .attr("d", d => path({type:"LineString", coordinates:[[d.lon1,d.lat1],[d.lon2,d.lat2]]}));
```
`d3.geoPath` bends the line along the projection (true great circles). For curved arcs instead, interpolate control points or use a quadratic SVG path between projected endpoints.

## Cartogram

D3 has no built-in area cartogram. Options:
- **Non-contiguous / Dorling**: replace each region with a circle sized by value, placed at the region centroid (`path.centroid(feature)`), optionally de-overlapped with `d3.forceCollide` + `forceX/forceY` toward centroids.
- **Contiguous** (distorted borders): use the external `cartogram-chart` / `topogram` library; D3 renders the resulting geometry with the same `geoPath`.
```js
// Dorling sketch
const nodes = geojson.features.map(f => ({
  x: path.centroid(f)[0], y: path.centroid(f)[1], r: r(valueById.get(f.id))
}));
d3.forceSimulation(nodes)
  .force("x", d3.forceX(d => d.x0 = d.x))
  .force("y", d3.forceY(d => d.y0 = d.y))
  .force("collide", d3.forceCollide(d => d.r + 1))
  .on("tick", () => circles.attr("cx", d => d.x).attr("cy", d => d.y));
```

### Interactivity
Add zoom/pan with `d3.zoom()` transforming the map `<g>` (see `interactivity.md`). Tooltips on regions/bubbles work exactly as elsewhere.