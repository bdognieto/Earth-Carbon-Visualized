console.log("D3 loaded");

Promise.all([
  d3.csv("data/processed/co2_timeseries.csv"),
  d3.csv("data/processed/cland_mean.csv")
]).then(([co2Data, clandData]) => {
  console.log("CO2 data:", co2Data);
  console.log("Land carbon data:", clandData);

  co2Data.forEach(d => {
    d.co2mass = +d.co2mass;
    d.year = new Date(d.time).getFullYear();
  });

  clandData.forEach(d => {
    d.latitude = +d.latitude;
    d.longitude = +d.longitude;
    d.cLand = +d.cLand;
  });

  console.log("Cleaned CO2:", co2Data.slice(0, 5));
  console.log("Cleaned cLand:", clandData.slice(0, 5));
});