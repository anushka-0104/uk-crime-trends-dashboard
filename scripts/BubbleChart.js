// scripts/BubbleChart.js
// Bubble chart: CSP-level comparison.
// Controls:
//  - Region dropdown: #bubble-regionSelect
//  - Metric dropdown: #bubble-metricSelect (bubble size by selected metric)
//  - Top-N dropdown: #bubble-topNSelect (keep chart readable)
//
// Data: data/bubbleChartData.csv
//
// Refactor goals:
// - keep it student-friendly
// - robust parsing + responsive sizing
// - avoid overcrowding using Top-N

(function () {
  const DATA_URL = "data/bubbleChartData.csv";

  const COL_REGION = "Region Name";
  const COL_PFA = "Police Force Area name";
  const COL_CSP = "Community Safety Partnership name";

  // We'll detect numeric metric columns dynamically from the CSV header.
  const META_COLS = new Set([COL_REGION, COL_PFA, COL_CSP]);

  class CSPBubbleChart {
    constructor(containerId) {
      this.containerId = containerId;

      this.root = d3.select(`#${containerId}`);
      this.svgEl = this.root.append("svg").attr("class", "bubble-chart-svg");
      this.g = this.svgEl.append("g").attr("class", "bubble-layer");

      this.width = 900;
      this.height = 600;

      this.data = [];      // parsed rows
      this.regions = [];
      this.metrics = [];   // metric columns available

      this.color = d3.scaleOrdinal(d3.schemeTableau10);

      this.tooltip = d3.select("body")
        .append("div")
        .attr("class", "bubble-tooltip")
        .style("opacity", 0);

      this.regionSelect = document.getElementById("bubble-regionSelect");
      this.metricSelect = document.getElementById("bubble-metricSelect");
      this.topNSelect = document.getElementById("bubble-topNSelect");

      this.setupEvents();
      this.setupResize();
    }

    setupEvents() {
      if (this.regionSelect) {
        this.regionSelect.addEventListener("change", () => this.render());
      }
      if (this.metricSelect) {
        this.metricSelect.addEventListener("change", () => this.render());
      }
      if (this.topNSelect) {
        this.topNSelect.addEventListener("change", () => this.render());
      }
    }

    setupResize() {
      window.addEventListener("resize", () => {
        this.resize();
        this.render();
      });
    }

    resize() {
      const box = this.root.node().getBoundingClientRect();
      const fullW = Math.max(650, box.width || 900);
      const fullH = Math.max(450, Math.min(window.innerHeight * 0.75, 700));

      this.width = fullW;
      this.height = fullH;

      this.svgEl
        .attr("width", this.width)
        .attr("height", this.height);

      this.g.attr("transform", `translate(0,0)`);
    }

    async load() {
      const utils = window.DashboardUtils;

      const rows = await d3.csv(DATA_URL);

      // Detect metric columns from CSV header
      const cols = rows.columns || Object.keys(rows[0] || {});
      this.metrics = cols.filter(c => !META_COLS.has(c));

      // Prefer "Total Recorded Crime" first if present
      const preferred = "Total Recorded Crime";
      if (this.metrics.includes(preferred)) {
        this.metrics = [preferred, ...this.metrics.filter(m => m !== preferred)];
      }

      // Parse rows
      this.data = rows.map(r => {
        const row = {
          region: utils.cleanText(r[COL_REGION]),
          policeForceArea: utils.cleanText(r[COL_PFA]),
          csp: utils.cleanText(r[COL_CSP])
        };

        this.metrics.forEach(m => {
          row[m] = utils.toNum(r[m], 0);
        });

        return row;
      });

      this.regions = Array.from(new Set(this.data.map(d => d.region)))
        .filter(Boolean)
        .sort(d3.ascending);

      this.populateRegionDropdown();
      this.populateMetricDropdown();

      this.resize();
    }

    populateRegionDropdown() {
      if (!this.regionSelect) return;

      this.regionSelect.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());

      this.regions.forEach(region => {
        const opt = document.createElement("option");
        opt.value = region;
        opt.textContent = region;
        this.regionSelect.appendChild(opt);
      });
    }

    populateMetricDropdown() {
      if (!this.metricSelect) return;

      // Keep the first option if it exists, then rebuild the rest
      this.metricSelect.querySelectorAll("option").forEach(o => o.remove());

      this.metrics.forEach(metric => {
        const opt = document.createElement("option");
        opt.value = metric;
        opt.textContent = metric;
        this.metricSelect.appendChild(opt);
      });

      // Default metric
      if (this.metrics.includes("Total Recorded Crime")) {
        this.metricSelect.value = "Total Recorded Crime";
      }
    }

    getSelectedRegion() {
      return this.regionSelect ? this.regionSelect.value : "all";
    }

    getSelectedMetric() {
      return this.metricSelect ? this.metricSelect.value : "Total Recorded Crime";
    }

    getSelectedTopN() {
      if (!this.topNSelect) return "all";
      return this.topNSelect.value;
    }

    getFilteredData() {
      const utils = window.DashboardUtils || {
        isAll: (v) => String(v ?? "").trim().toLowerCase() === "all"
      };

      const selectedRegion = this.getSelectedRegion();
      const metric = this.getSelectedMetric();
      const topN = this.getSelectedTopN();

      const regionIsAll = utils.isAll(selectedRegion);

      // Filter by region
      let rows = this.data.filter(d => regionIsAll || d.region === selectedRegion);

      // Remove zeros for chosen metric (pack looks nicer)
      rows = rows.filter(d => (d[metric] || 0) > 0);

      // Apply Top-N if selected
      if (!utils.isAll(topN)) {
        const n = Number(topN);
        if (Number.isFinite(n) && n > 0) {
          rows = rows
            .slice()
            .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
            .slice(0, n);
        }
      }

      return rows;
    }

    buildHierarchy(rows, metric) {
      return d3.hierarchy({ children: rows })
        .sum(d => d[metric] || 0)
        .sort((a, b) => b.value - a.value);
    }

    render() {
      if (!this.data || this.data.length === 0) return;

      const metric = this.getSelectedMetric();
      const rows = this.getFilteredData();

      if (rows.length === 0) {
        this.g.selectAll("*").remove();
        return;
      }

      // Color by police force areas (within filtered data)
      const pfas = Array.from(new Set(rows.map(d => d.policeForceArea)))
        .filter(Boolean)
        .sort(d3.ascending);
      this.color.domain(pfas);

      const root = this.buildHierarchy(rows, metric);

      const pack = d3.pack()
        .size([this.width, this.height])
        .padding(3);

      const packed = pack(root);
      const leaves = packed.leaves();

      const nodes = this.g.selectAll(".bubble-node")
        .data(leaves, d => d.data.csp);

      nodes.exit().remove();

      const enter = nodes.enter()
        .append("g")
        .attr("class", "bubble-node")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .on("mousemove", (event, d) => this.showTooltip(event, d, metric))
        .on("mouseout", () => this.hideTooltip());

      enter.append("circle")
        .attr("r", 0)
        .attr("fill", d => this.color(d.data.policeForceArea))
        .attr("fill-opacity", 0.85)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.2)
        .transition()
        .duration(650)
        .attr("r", d => d.r);

      enter.append("text")
        .attr("class", "bubble-label")
        .style("text-anchor", "middle")
        .style("pointer-events", "none")
        .style("font-size", "11px")
        .style("fill", "#1f2d3d");

      const merged = enter.merge(nodes);

      merged.transition()
        .duration(450)
        .attr("transform", d => `translate(${d.x},${d.y})`);

      merged.select("circle")
        .transition()
        .duration(450)
        .attr("r", d => d.r)
        .attr("fill", d => this.color(d.data.policeForceArea));

      merged.select("text")
        .text(d => this.getShortLabel(d))
        .style("display", d => (d.r >= 28 ? "block" : "none"));
    }

    getShortLabel(d) {
      const name = d.data.csp || "";
      if (name.length <= 18) return name;
      return name.slice(0, 16) + "…";
    }

    showTooltip(event, d, metric) {
      const val = d.data[metric] || 0;

      this.tooltip
        .style("opacity", 1)
        .html(`
          <div class="bubble-tooltip-title"><strong>${d.data.csp}</strong></div>
          <div><strong>Region:</strong> ${d.data.region}</div>
          <div><strong>Police Force:</strong> ${d.data.policeForceArea}</div>
          <div><strong>${metric}:</strong> ${d3.format(",")(val)}</div>
        `)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    }

    hideTooltip() {
      this.tooltip.style("opacity", 0);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const chart = new CSPBubbleChart("bubble-chart");
    await chart.load();
    chart.render();
  });
})();
