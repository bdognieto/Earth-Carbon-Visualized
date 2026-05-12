console.log("D3 loaded");

Promise.all([
  d3.csv("data/processed/co2_timeseries.csv"),
  d3.csv("data/processed/cland_mean.csv")
]).then(([co2Data, clandData]) => {

  co2Data.forEach(d => {
    d.co2mass = +d.co2mass;
    d.year = +d.year;
  });

  co2Data = co2Data.filter(d =>
    Number.isFinite(d.year) &&
    Number.isFinite(d.co2mass) &&
    d.scenario
  );

  clandData.forEach(d => {
    d.latitude = +d.latitude;
    d.longitude = +d.longitude;
    d.cLand = +d.cLand;
  });

  const width = 800;
  const height = 400;
  const margin = { top: 40, right: 120, bottom: 55, left: 90 };

  const svg = d3.select("#co2-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const x = d3.scaleLinear()
    .domain(d3.extent(co2Data, d => d.year))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain(d3.extent(co2Data, d => d.co2mass))
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(
      d3.axisLeft(y)
        .ticks(6)
        .tickFormat(d => `${(d / 1e15).toFixed(1)}`)
    );

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Year");

  svg.append("text")
    .attr("x", -height / 2)
    .attr("y", 25)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Atmospheric CO₂ Mass (×10¹⁵ kg)");

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.co2mass));

  const grouped = d3.group(co2Data, d => d.scenario);

  const color = d3.scaleOrdinal()
    .domain(["historical", "ssp245", "ssp585"])
    .range(["#555555", "#f28e2b", "#e15759"]);

  svg.selectAll(".co2-line")
    .data(grouped)
    .join("path")
    .attr("class", "co2-line")
    .attr("fill", "none")
    .attr("stroke", ([scenario]) => color(scenario))
    .attr("stroke-width", 2.5)
    .attr("d", ([scenario, values]) => {
      values.sort((a, b) => a.year - b.year);
      return line(values);
    });

  const legend = svg.append("g")
    .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

  ["historical", "ssp245", "ssp585"].forEach((scenario, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(0, ${i * 24})`);

    row.append("line")
      .attr("x1", 0)
      .attr("x2", 20)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", color(scenario))
      .attr("stroke-width", 3);

    row.append("text")
      .attr("x", 28)
      .attr("y", 5)
      .text(scenario);
  });

  const mapWidth = 900;
  const mapHeight = 450;

  const mapSvg = d3.select("#carbon-map")
    .append("svg")
    .attr("width", mapWidth)
    .attr("height", mapHeight);

  const projection = d3.geoNaturalEarth1()
    .scale(170)
    .translate([mapWidth / 2, mapHeight / 2]);

  const colorScale = d3.scaleSequential(d3.interpolateYlGn)
    .domain(d3.extent(clandData, d => d.cLand));

  mapSvg.selectAll("circle")
    .data(clandData)
    .join("circle")
    .attr("cx", d => projection([d.longitude, d.latitude])[0])
    .attr("cy", d => projection([d.longitude, d.latitude])[1])
    .attr("r", 1.5)
    .attr("fill", d => colorScale(d.cLand))
    .attr("opacity", 0.7);
});