// scripts/barChart.js
// Bar chart: crime category distribution for selected Region + Police Force Area.
//
// Refactor goals (student-authentic, not over-engineered):
// - Fix container mismatch (#bar-chart)
// - Avoid resizing "all svgs" (only resize this chart)
// - Parse numeric columns once
// - Make filters robust ("all" vs "All", whitespace)
// - Don't depend on non-existent buttons

(function () {
  class BarCrimeChart {
    constructor(containerId, data) {
      this.containerId = containerId;
      this.rawData = data;

      this.margin = { top: 60, right: 30, bottom: 150, left: 100 };
      this.updateDimensions();

      // Root selection
      this.root = d3.select(`#${containerId}`);

      // SVG shell
      this.svgEl = this.root
        .append("svg")
        .attr("class", "bar-chart-svg")
        .attr("width", this.width + this.margin.left + this.margin.right)
        .attr("height", this.height + this.margin.top + this.margin.bottom);

      // Inner plotting group
      this.svg = this.svgEl
        .append("g")
        .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

      // Tooltip (only create once)
      this.tooltip = d3.select("body")
        .append("div")
        .attr("class", "bar-tooltip")
        .style("opacity", 0);

      // Categories (must match CSV column names)
      this.crimeTypes = [
        "Violence against the person",
        "Sexual offences",
        "Robbery",
        "Theft offences",
        "Criminal damage and arson",
        "Drug offences",
        "Possession of weapons offences",
        "Public order offences",
        "Miscellaneous crimes"
      ];

      // Color scale
      this.color = d3.scaleOrdinal(d3.schemeCategory10);

      // Clean + parse once
      this.data = this.prepareData(this.rawData);

      // Setup filters and initial render
      this.initializeFilters();
      this.updateTerritoryFilter(this.getSelectedRegion());
      this.updateChart();

      // Resize handler
      window.addEventListener("resize", () => this.onResize());
    }

    // ---------- Data prep ----------
    prepareData(data) {
      const { cleanText, toNum } = window.DashboardUtils;

      return data.map(d => {
        const cleaned = {
          Region: cleanText(d.Region),
          Territory: cleanText(d.Territory)
        };

        // Parse each category column as number
        this.crimeTypes.forEach(type => {
          cleaned[type] = toNum(d[type], 0);
        });

        return cleaned;
      });
    }

    // ---------- Sizing ----------
    updateDimensions() {
      // Keep it responsive but not absurdly tall.
      this.width = Math.max(500, window.innerWidth - this.margin.left - this.margin.right);
      this.height = Math.max(320, window.innerHeight * 0.65 - this.margin.top - this.margin.bottom);
    }

    onResize() {
      this.updateDimensions();

      this.svgEl
        .attr("width", this.width + this.margin.left + this.margin.right)
        .attr("height", this.height + this.margin.top + this.margin.bottom);

      this.updateChart();
    }

    // ---------- Filters ----------
    initializeFilters() {
      const regionFilter = d3.select("#bar-region-filter");
      const territoryFilter = d3.select("#bar-territory-filter");

      // Populate region options (skip empty)
      const regions = [...new Set(this.data.map(d => d.Region))]
        .filter(r => r && r.toLowerCase() !== "all")
        .sort(d3.ascending);

      // NOTE: index.html already has the first option value="all"
      // so we only append real regions.
      regions.forEach(region => {
        regionFilter.append("option")
          .attr("value", region)
          .text(region);
      });

      // Hook up change events
      regionFilter.on("change", () => this.onRegionChange());
      territoryFilter.on("change", () => this.updateChart());
    }

    getSelectedRegion() {
      const el = d3.select("#bar-region-filter").node();
      return el ? el.value : "all";
    }

    getSelectedTerritory() {
      const el = d3.select("#bar-territory-filter").node();
      return el ? el.value : "all";
    }

    onRegionChange() {
      const selectedRegion = this.getSelectedRegion();
      this.updateTerritoryFilter(selectedRegion);
      this.updateChart();
    }

    updateTerritoryFilter(selectedRegion) {
      const territoryFilter = d3.select("#bar-territory-filter");

      // Remove old options except the first (All Police Force Areas)
      territoryFilter.selectAll("option:not(:first-child)").remove();

      const isAllRegion = String(selectedRegion).toLowerCase() === "all";

      let territories = isAllRegion
        ? [...new Set(this.data.map(d => d.Territory))]
        : [...new Set(this.data.filter(d => d.Region === selectedRegion).map(d => d.Territory))];

      territories = territories.filter(Boolean).sort(d3.ascending);

      territories.forEach(territory => {
        territoryFilter.append("option")
          .attr("value", territory)
          .text(territory);
      });

      // Reset territory to "all" after region switch (keeps behavior predictable)
      const territoryNode = territoryFilter.node();
      if (territoryNode) territoryNode.value = "all";
    }

    // ---------- Aggregation ----------
    getFilteredRows() {
      const selectedRegion = this.getSelectedRegion();
      const selectedTerritory = this.getSelectedTerritory();

      const regionIsAll = String(selectedRegion).toLowerCase() === "all";
      const territoryIsAll = String(selectedTerritory).toLowerCase() === "all";

      return this.data.filter(d =>
        (regionIsAll || d.Region === selectedRegion) &&
        (territoryIsAll || d.Territory === selectedTerritory)
      );
    }

    aggregateCrimeData(rows) {
      return this.crimeTypes
        .map(type => ({
          name: type,
          value: d3.sum(rows, r => r[type] || 0)
        }))
        .sort((a, b) => b.value - a.value);
    }

    // ---------- Rendering ----------
    updateChart() {
      const rows = this.getFilteredRows();
      const crimeData = this.aggregateCrimeData(rows);

      // Scales
      const xScale = d3.scaleBand()
        .domain(crimeData.map(d => d.name))
        .range([0, this.width])
        .padding(0.2);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(crimeData, d => d.value) || 0])
        .nice()
        .range([this.height, 0]);

      // Clear (simple + readable; ok for coursework portfolio)
      this.svg.selectAll("*").remove();

      // Axes
      this.svg.append("g")
        .attr("transform", `translate(0,${this.height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

      this.svg.append("g")
        .call(d3.axisLeft(yScale));

      // Labels
      this.svg.append("text")
        .attr("x", this.width / 2)
        .attr("y", this.height + 90)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .text("Type of Crimes");

      this.svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -this.height / 2)
        .attr("y", -60)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .text("Crime Count");

      // Bars
      this.svg.selectAll(".bar-rect")
        .data(crimeData, d => d.name)
        .enter()
        .append("rect")
        .attr("class", "bar-rect")
        .attr("x", d => xScale(d.name))
        .attr("width", xScale.bandwidth())
        .attr("y", this.height)
        .attr("height", 0)
        .attr("fill", d => this.color(d.name))
        .on("mouseover", (event, d) => {
          this.tooltip
            .transition()
            .duration(150)
            .style("opacity", 1);

          this.tooltip
            .html(`Crime Type: <strong>${d.name}</strong><br>Cases: ${d.value.toLocaleString()}`)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", () => {
          this.tooltip
            .transition()
            .duration(250)
            .style("opacity", 0);
        })
        .transition()
        .duration(700)
        .attr("y", d => yScale(d.value))
        .attr("height", d => this.height - yScale(d.value));
    }
  }

  // Bootstrap
  document.addEventListener("DOMContentLoaded", function () {
    d3.csv("data/barChart.csv").then(data => {
      // index.html has: <div id="bar-chart"></div>
      new BarCrimeChart("bar-chart", data);
    });
  });
})();

