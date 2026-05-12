// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIOS = ["historical", "ssp245", "ssp585"];
const COLOR = d3.scaleOrdinal()
  .domain(SCENARIOS)
  .range(["#555555", "#f28e2b", "#e15759"]);

const SCENARIO_LABELS = {
  historical: "Historical",
  ssp245: "SSP2-4.5",
  ssp585: "SSP5-8.5"
};

let activeScenarios = new Set(SCENARIOS);
let brushedDomain = null; // [yearMin, yearMax] when brush active

// ─── Load all data ─────────────────────────────────────────────────────────

Promise.all([
  d3.csv("data/processed/co2_timeseries.csv"),
  d3.csv("data/processed/tas_timeseries.csv"),
  d3.csv("data/processed/fgco2_timeseries.csv"),
  d3.csv("data/processed/cland_mean.csv"),
]).then(([co2Raw, tasRaw, fgco2Raw, clandMapRaw]) => {

  // ── Parse ────────────────────────────────────────────────────────────────

  const parse = (rows, valueKey) => rows
    .map(d => ({ year: +d.year, value: +d[valueKey], scenario: d.scenario }))
    .filter(d => Number.isFinite(d.year) && Number.isFinite(d.value) && d.scenario);

  const co2Data   = parse(co2Raw,   "co2mass");
  const tasData   = parse(tasRaw,   "tas");
  const fgco2Data = parse(fgco2Raw, "fgco2");

  const mapData = clandMapRaw.map(d => ({
    latitude:  +d.latitude,
    longitude: +d.longitude,
    cLand:     +d.cLand,
  })).filter(d => d.cLand > 0);

  // global year extent across all datasets
  const allYears = [...co2Data, ...tasData, ...fgco2Data].map(d => d.year);
  const yearExtent = d3.extent(allYears);

  // ── Shared x-scale (year) ────────────────────────────────────────────────
  // Each chart creates its own local x from this domain.
  // brushedDomain overrides yearExtent when brush is active.

  const getXDomain = () => brushedDomain || yearExtent;

  // ── Build all charts ─────────────────────────────────────────────────────

  const charts = [
    buildLineChart("#co2-chart",   co2Data,   "co2mass", "CO₂ Mass (×10¹⁵ kg)",     v => (v / 1e15).toFixed(2)),
    buildLineChart("#tas-chart",   tasData,   "tas",     "Temperature (°C)",         v => v.toFixed(2)),
    buildLineChart("#fgco2-chart", fgco2Data, "fgco2",   "Ocean Flux (g m⁻² yr⁻¹)", v => v.toFixed(3)),
  ];

  buildBrushChart("#brush-chart", yearExtent, charts, getXDomain);
  buildMap("#carbon-map", mapData);

  // ── Scenario toggles ─────────────────────────────────────────────────────

  d3.selectAll(".toggle-btn").on("click", function () {
    const sc = this.dataset.scenario;
    if (activeScenarios.has(sc)) {
      if (activeScenarios.size === 1) return; // keep at least one
      activeScenarios.delete(sc);
      this.classList.remove("active");
    } else {
      activeScenarios.add(sc);
      this.classList.add("active");
    }
    charts.forEach(c => c.updateVisibility());
  });

  // ── Line chart factory ───────────────────────────────────────────────────

  function buildLineChart(selector, data, valueKey, yLabel, fmt) {
    const W = 520, H = 280;
    const M = { top: 20, right: 130, bottom: 40, left: 70 };
    const iW = W - M.left - M.right;
    const iH = H - M.top  - M.bottom;

    const svg = d3.select(selector).append("svg")
      .attr("width",  W)
      .attr("height", H)
      .attr("viewBox", `0 0 ${W} ${H}`)
      .style("overflow", "visible");

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    // clip so lines don't spill outside plot area
    const clipId = selector.replace("#", "clip-");
    svg.append("defs").append("clipPath").attr("id", clipId)
      .append("rect").attr("width", iW).attr("height", iH + 2).attr("y", -1);

    // scales
    const x = d3.scaleLinear().range([0, iW]);
    const yAll = data.map(d => d.value);
    const y = d3.scaleLinear()
      .domain(d3.extent(yAll)).nice()
      .range([iH, 0]);

    // axes
    const xAxisG = g.append("g").attr("transform", `translate(0,${iH})`);
    const yAxisG = g.append("g");

    g.append("text").attr("class", "axis-label")
      .attr("x", iW / 2).attr("y", iH + 35)
      .attr("text-anchor", "middle").text("Year");

    g.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -iH / 2).attr("y", -58)
      .attr("text-anchor", "middle").text(yLabel);

    // lines per scenario
    const lineGen = d3.line().x(d => x(d.year)).y(d => y(d.value));
    const grouped = d3.group(data, d => d.scenario);

    const linesG = g.append("g").attr("clip-path", `url(#${clipId})`);

    const paths = linesG.selectAll(".line")
      .data(SCENARIOS)
      .join("path")
      .attr("class", d => `line sc-${d}`)
      .attr("fill", "none")
      .attr("stroke", d => COLOR(d))
      .attr("stroke-width", 2.5);

    // legend
    const legend = g.append("g").attr("transform", `translate(${iW + 12}, 10)`);
    SCENARIOS.forEach((sc, i) => {
      const row = legend.append("g").attr("transform", `translate(0,${i * 22})`);
      row.append("line").attr("x2", 18).attr("stroke", COLOR(sc)).attr("stroke-width", 3);
      row.append("text").attr("x", 24).attr("y", 5).attr("class", "legend-label").text(SCENARIO_LABELS[sc]);
    });

    // "we are here" annotation (2025)
    const annotYear = 2025;
    const annotG = g.append("g").attr("class", "annot-now");
    annotG.append("line").attr("stroke", "#aaa").attr("stroke-dasharray", "3,3")
      .attr("y1", 0).attr("y2", iH);
    annotG.append("text").attr("dy", -4).attr("text-anchor", "middle")
      .attr("class", "annot-text").text("2025");

    // tooltip crosshair
    const crosshairG = g.append("g").attr("class", "crosshair").style("display", "none");
    crosshairG.append("line").attr("class", "crosshair-line")
      .attr("y1", 0).attr("y2", iH)
      .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

    const tooltip = d3.select(selector).append("div").attr("class", "tooltip");

    // overlay for mouse events
    g.append("rect")
      .attr("width", iW).attr("height", iH)
      .attr("fill", "none").attr("pointer-events", "all")
      .on("mousemove", onMouseMove)
      .on("mouseleave", () => {
        crosshairG.style("display", "none");
        tooltip.style("opacity", 0);
      });

    function onMouseMove(event) {
      const [mx] = d3.pointer(event);
      const year = Math.round(x.invert(mx));
      crosshairG.style("display", null)
        .select("line").attr("x1", x(year)).attr("x2", x(year));

      const lines = [];
      grouped.forEach((vals, sc) => {
        if (!activeScenarios.has(sc)) return;
        const row = vals.find(d => d.year === year);
        if (row) lines.push(`<span style="color:${COLOR(sc)}">${SCENARIO_LABELS[sc]}:</span> ${fmt(row.value)}`);
      });

      tooltip
        .style("opacity", 1)
        .style("left", `${event.offsetX + 16}px`)
        .style("top",  `${event.offsetY - 10}px`)
        .html(`<strong>${year}</strong><br>${lines.join("<br>")}`);
    }

    function redraw() {
      const domain = getXDomain();
      x.domain(domain);
      xAxisG.call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(5));
      yAxisG.call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2s")));

      SCENARIOS.forEach(sc => {
        const vals = (grouped.get(sc) || [])
          .filter(d => d.year >= domain[0] && d.year <= domain[1])
          .sort((a, b) => a.year - b.year);
        paths.filter(d => d === sc).attr("d", vals.length ? lineGen(vals) : null);
      });

      // annotation
      if (annotYear >= domain[0] && annotYear <= domain[1]) {
        annotG.style("display", null)
          .attr("transform", `translate(${x(annotYear)}, 0)`);
      } else {
        annotG.style("display", "none");
      }
    }

    function updateVisibility() {
      paths.attr("opacity", d => activeScenarios.has(d) ? 1 : 0.08)
           .attr("stroke-width", d => activeScenarios.has(d) ? 2.5 : 1);
      legend.selectAll("text.legend-label")
        .attr("opacity", (d, i) => activeScenarios.has(SCENARIOS[i]) ? 1 : 0.3);
    }

    redraw();
    return { redraw, updateVisibility };
  }

  // ── Brush/context chart ──────────────────────────────────────────────────

  function buildBrushChart(selector, yearExtent, charts, getXDomain) {
    const W = 1100, H = 60;
    const M = { top: 8, right: 20, bottom: 24, left: 70 };
    const iW = W - M.left - M.right;
    const iH = H - M.top  - M.bottom;

    const svg = d3.select(selector).append("svg")
      .attr("width", W).attr("height", H)
      .attr("viewBox", `0 0 ${W} ${H}`);

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    const x = d3.scaleLinear().domain(yearExtent).range([0, iW]);
    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(10));

    // thin background lines for context
    const miniLine = d3.line().x(d => x(d.year)).y(() => iH / 2);
    const grouped  = d3.group(co2Data, d => d.scenario);
    // use co2Data scaled to mini height
    const yMini = d3.scaleLinear()
      .domain(d3.extent(co2Data, d => d.value)).range([iH, 0]);
    const lineGen = d3.line().x(d => x(d.year)).y(d => yMini(d.value));

    SCENARIOS.forEach(sc => {
      const vals = (grouped.get(sc) || []).sort((a, b) => a.year - b.year);
      g.append("path").attr("fill","none").attr("stroke", COLOR(sc))
        .attr("stroke-width", 1).attr("opacity", 0.5).attr("d", lineGen(vals));
    });

    // brush
    const brush = d3.brushX()
      .extent([[0, 0], [iW, iH]])
      .on("brush end", ({ selection }) => {
        if (selection) {
          brushedDomain = selection.map(x.invert).map(Math.round);
        } else {
          brushedDomain = null;
        }
        charts.forEach(c => c.redraw());
      });

    g.append("g").attr("class", "brush").call(brush);
  }

  // ── Map ───────────────────────────────────────────────────────────────────

  function buildMap(selector, data) {
    const W = 960, H = 480;

    const svg = d3.select(selector).append("svg")
      .attr("width", W).attr("height", H)
      .attr("viewBox", `0 0 ${W} ${H}`)
      .style("cursor", "grab");

    const projection = d3.geoNaturalEarth1()
      .scale(153)
      .translate([W / 2, H / 2]);

    const colorScale = d3.scaleSequential(d3.interpolateYlGn)
      .domain(d3.extent(data, d => d.cLand));

    // graticule
    const path = d3.geoPath().projection(projection);
    svg.append("path")
      .datum(d3.geoGraticule()())
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.3);

    // sphere outline
    svg.append("path")
      .datum({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "#d6eaf8")
      .attr("stroke", "#aaa")
      .attr("stroke-width", 0.5);

    const dotG = svg.append("g");

    const dots = dotG.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => projection([d.longitude, d.latitude])[0])
      .attr("cy", d => projection([d.longitude, d.latitude])[1])
      .attr("r", 1.6)
      .attr("fill", d => colorScale(d.cLand))
      .attr("opacity", 0.75);

    // tooltip
    const mapTip = d3.select(selector).append("div").attr("class", "tooltip");

    dots.on("mousemove", function (event, d) {
      d3.select(this).attr("r", 3).attr("opacity", 1);
      mapTip.style("opacity", 1)
        .style("left", `${event.offsetX + 14}px`)
        .style("top",  `${event.offsetY - 10}px`)
        .html(`Lat: ${d.latitude.toFixed(1)}° Lon: ${d.longitude.toFixed(1)}°<br>
               <strong>cLand: ${d.cLand.toFixed(3)} kg m⁻²</strong>`);
    }).on("mouseleave", function () {
      d3.select(this).attr("r", 1.6).attr("opacity", 0.75);
      mapTip.style("opacity", 0);
    });

    // zoom + pan
    const zoom = d3.zoom()
      .scaleExtent([1, 12])
      .on("zoom", ({ transform }) => {
        dotG.attr("transform", transform);
        dotG.selectAll("circle").attr("r", 1.6 / transform.k).attr("opacity", 0.75);
        svg.style("cursor", "grabbing");
      })
      .on("end", () => svg.style("cursor", "grab"));

    svg.call(zoom);

    // color legend
    const legendW = 160, legendH = 10;
    const legendSvg = d3.select(selector).append("svg")
      .attr("width", legendW + 60).attr("height", 36)
      .style("display", "block").style("margin", "4px auto 0");

    const defs = legendSvg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "map-grad");
    const domain = colorScale.domain();
    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
      grad.append("stop").attr("offset", `${t * 100}%`)
        .attr("stop-color", colorScale(domain[0] + t * (domain[1] - domain[0])));
    });

    legendSvg.append("rect").attr("x", 30).attr("width", legendW).attr("height", legendH)
      .attr("fill", "url(#map-grad)").attr("rx", 2);
    legendSvg.append("text").attr("x", 30).attr("y", 25).attr("class", "legend-label")
      .text(domain[0].toFixed(1));
    legendSvg.append("text").attr("x", 30 + legendW).attr("y", 25)
      .attr("text-anchor", "end").attr("class", "legend-label")
      .text(domain[1].toFixed(1) + " kg m⁻²");
  }

}).catch(err => {
  console.error("Data load error:", err);
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="load-error">⚠️ Could not load one or more data files. Run a local server and ensure all CSVs are in data/processed/. Details: ${err.message}</div>`);
});
