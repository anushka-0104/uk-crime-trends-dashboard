// scripts/lineChart.js
// Line chart: total recorded crime trend (2020–2024) by Region.
//
// Refactor goals:
// - Match current HTML UI (only #line-region exists)
// - Load yearly CSVs and aggregate totals by region
// - If region = "all": show one line per region (readable number of lines)
// - If region = specific: show a single highlighted line
// - Responsive resize without rebuilding the whole app
// - Keep it student-friendly (simple structure, clear functions)

(function () {
  const lineCsvFiles = {
    "2020": "data/lineChart2020.csv",
    "2021": "data/lineChart2021.csv",
    "2022": "data/lineChart2022.csv",
    "2023": "data/lineChart2023.csv",
    "2024": "data/lineChart2024.csv"
  };

  const CRIME_TOTAL_COL_CANDIDATES = [
    "Total record",
    "Total recorded crime",
    "Total",
    "Total_recorded_crime"
  ];

  const margin = { top: 40, right: 190, bottom: 60, left: 70 };

  class RegionTrendLineChart {
    constructor(containerId) {
      this.containerId = containerId;

      this.root = d3.select(`#${containerId}`);
      this.svgEl = this.root.append("svg").attr("class", "line-chart-svg");
      this.svg = this.svgEl.append("g");

      this.width = 800;
      this.height = 400;

      this.x = d3.scalePoint().padding(0.5);
      this.y = d3.scaleLinear();

      this.color = d3.scaleOrdinal(d3.schemeCategory10);

      this.lineGen = d3.line()
        .x(d => this.x(d.year))
        .y(d => this.y(d.value));

      // Axes groups
      this.gX = this.svg.append("g").attr("class", "line-x-axis");
      this.gY = this.svg.append("g").attr("class", "line-y-axis");

      // Axis labels
      this.xLabel = this.svg.append("text")
        .attr("class", "line-axis-label line-x")
        .style("text-anchor", "middle")
        .text("Year");

      this.yLabel = this.svg.append("text")
        .attr("class", "line-axis-label line-y")
        .attr("transform", "rotate(-90)")
        .style("text-anchor", "middle")
        .text("Total recorded crime");

      // Tooltip (simple)
      this.tooltip = d3.select("body")
        .append("div")
        .attr("class", "line-tooltip")
        .style("opacity", 0);

      // Data
      this.regionYearTotals = []; // [{region, year, value}]
      this.regions = [];

      this.setupResize();
    }

    setupResize() {
      window.addEventListener("resize", () => this.resizeAndRender());
    }

    resizeAndRender() {
      const box = this.root.node().getBoundingClientRect();

      // Fallback sizes if container is not styled yet
      const fullW = Math.max(600, box.width || 900);
      const fullH = Math.max(360, box.height || 500);

      this.width = fullW - margin.left - margin.right;
      this.height = fullH - margin.top - margin.bottom;

      this.svgEl
        .attr("width", fullW)
        .attr("height", fullH);

      this.svg.attr("transform", `translate(${margin.left},${margin.top})`);

      // Update scale ranges
      this.x.range([0, this.width]);
      this.y.range([this.height, 0]);

      // Update label positions
      this.xLabel
        .attr("x", this.width / 2)
        .attr("y", this.height + 45);

      this.yLabel
        .attr("x", -this.height / 2)
        .attr("y", -50);

      // Re-render with current filter
      this.render();
    }

    // ---- Data loading & preparation ----
    async loadAllYears() {
      const { cleanText, toNum } = window.DashboardUtils;

      const years = Object.keys(lineCsvFiles);

      const loaded = await Promise.all(
        years.map(async (year) => {
          const url = lineCsvFiles[year];
          const rows = await d3.csv(url);

          // find best total column
          const cols = rows.columns || Object.keys(rows[0] || {});
          const totalCol = CRIME_TOTAL_COL_CANDIDATES.find(c => cols.includes(c));

          return rows.map(r => ({
            year,
            region: cleanText(r.Region),
            total: totalCol ? toNum(r[totalCol], 0) : 0
          }));
        })
      );

      const allRows = loaded.flat();

      // Aggregate totals by (region, year)
      const totalsMap = new Map(); // key: `${region}__${year}`
      allRows.forEach(r => {
        if (!r.region) return;
        const key = `${r.region}__${r.year}`;
        const prev = totalsMap.get(key) || 0;
        totalsMap.set(key, prev + r.total);
      });

      this.regionYearTotals = Array.from(totalsMap.entries()).map(([key, value]) => {
        const [region, year] = key.split("__");
        return { region, year, value };
      });

      this.regions = Array.from(new Set(this.regionYearTotals.map(d => d.region)))
        .filter(Boolean)
        .sort(d3.ascending);
    }

    populateRegionDropdown() {
      const regionSelect = d3.select("#line-region");
      if (regionSelect.empty()) return;

      // keep the first option (all)
      regionSelect.selectAll("option:not(:first-child)").remove();

      this.regions.forEach(region => {
        regionSelect.append("option")
          .attr("value", region)
          .text(region);
      });
    }

    getSelectedRegion() {
      const el = d3.select("#line-region").node();
      return el ? el.value : "all";
    }

    // ---- Rendering ----
    render() {
      const years = Object.keys(lineCsvFiles);

      // Update x domain
      this.x.domain(years);

      const selectedRegion = this.getSelectedRegion();
      const regionIsAll = String(selectedRegion).toLowerCase() === "all";

      let grouped;
      if (regionIsAll) {
        // All regions: show one line per region (manageable: ~9–10)
        grouped = d3.group(this.regionYearTotals, d => d.region);
      } else {
        // One region: render only that region
        grouped = d3.group(
          this.regionYearTotals.filter(d => d.region === selectedRegion),
          d => d.region
        );
      }

      const regionsToDraw = Array.from(grouped.keys());

      // If nothing, clear and return
      if (regionsToDraw.length === 0) {
        this.svg.selectAll(".region-line").remove();
        this.svg.selectAll(".region-point").remove();
        this.svg.selectAll(".line-legend").remove();
        return;
      }

      // Compute y domain across drawn data
      const drawnData = regionsToDraw.flatMap(r => grouped.get(r) || []);
      const maxY = d3.max(drawnData, d => d.value) || 0;
      this.y.domain([0, maxY * 1.08]).nice();

      // Axes
      this.gX
        .attr("transform", `translate(0,${this.height})`)
        .call(d3.axisBottom(this.x).tickSizeOuter(0));

      this.gY
        .call(d3.axisLeft(this.y).tickFormat(d3.format(".2s")));

      // Lines
      const lines = this.svg.selectAll(".region-line")
        .data(regionsToDraw, d => d);

      lines.exit().remove();

      lines.enter()
        .append("path")
        .attr("class", "region-line")
        .attr("fill", "none")
        .attr("stroke-width", 2.2)
        .merge(lines)
        .attr("stroke", region => this.color(region))
        .attr("opacity", regionIsAll ? 0.95 : 1)
        .transition()
        .duration(500)
        .attr("d", region => {
          const series = (grouped.get(region) || [])
            .slice()
            .sort((a, b) => years.indexOf(a.year) - years.indexOf(b.year));
          return this.lineGen(series);
        });

      // Points (for tooltip)
      const points = this.svg.selectAll(".region-point")
        .data(
          drawnData.map(d => ({
            region: d.region,
            year: d.year,
            value: d.value
          })),
          d => `${d.region}__${d.year}`
        );

      points.exit().remove();

      points.enter()
        .append("circle")
        .attr("class", "region-point")
        .attr("r", 4)
        .attr("stroke", "white")
        .attr("stroke-width", 1.4)
        .on("mouseover", (event, d) => this.showTooltip(event, d))
        .on("mouseout", () => this.hideTooltip())
        .merge(points)
        .attr("fill", d => this.color(d.region))
        .attr("cx", d => this.x(d.year))
        .attr("cy", d => this.y(d.value));

      // Legend (simple, right side)
      this.renderLegend(regionsToDraw, regionIsAll);
    }

    renderLegend(regions, isAll) {
      // If only one region selected, legend is optional — but we’ll keep it for consistency.
      const legendX = this.width + 20;
      const legendY = 10;

      // Remove old legend
      this.svg.selectAll(".line-legend").remove();

      const legend = this.svg.append("g")
        .attr("class", "line-legend")
        .attr("transform", `translate(${legendX},${legendY})`);

      // If "all", show full region list. If not, show selected region only.
      const items = legend.selectAll(".legend-item")
        .data(regions, d => d)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 18})`);

      items.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", d => this.color(d));

      items.append("text")
        .attr("x", 18)
        .attr("y", 10)
        .style("font-size", "12px")
        .text(d => d);
    }

    // ---- Tooltip ----
    showTooltip(event, d) {
      this.tooltip
        .style("opacity", 1)
        .html(`
          <div class="line-tooltip-title"><strong>${d.region}</strong></div>
          <div><strong>Year:</strong> ${d.year}</div>
          <div><strong>Total:</strong> ${d3.format(",")(d.value)}</div>
        `)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);
    }

    hideTooltip() {
      this.tooltip.style("opacity", 0);
    }
  }

  // ---- Bootstrap ----
  document.addEventListener("DOMContentLoaded", async () => {
    const chart = new RegionTrendLineChart("line-chart");

    await chart.loadAllYears();
    chart.populateRegionDropdown();
    chart.resizeAndRender();

    // Update on dropdown change
    const regionSelect = document.getElementById("line-region");
    if (regionSelect) {
      regionSelect.addEventListener("change", () => chart.render());
    }
  });
})();
