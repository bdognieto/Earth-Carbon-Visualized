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
  const margin = { top: 40, right: 40, bottom: 50, left: 80 };

  const svg = d3.select("#co2-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const x = d3.scaleLinear()
    .domain(d3.extent(co2Data, d => d.year))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain(d3.extent(co2Data, d => d.co2mass))
    .range([height - margin.bottom, margin.top]);

  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y));

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.co2mass));

  const grouped = d3.group(co2Data, d => d.scenario);
  
  svg.selectAll(".co2-line")
    .data(grouped)
    .join("path")
    .attr("class", "co2-line")
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", ([scenario, values]) => {
      values.sort((a, b) => a.year - b.year);
       return line(values);
    });
});