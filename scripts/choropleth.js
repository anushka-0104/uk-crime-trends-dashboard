// scripts/choropleth.js
// Choropleth: Police Force Areas colored by selected crime metric.
// Data join: CSV "Territory Code" <-> GeoJSON properties "PFA23CD".
//
// Refactor goals:
// - Match current HTML controls
// - Robust join + parsing
// - Filter by Region and Police Force Area
// - Select metric (crime type)
// - Responsive resize (only this SVG)

(function () {
  const CSV_URL = "data/ChoroplethMap_Transformed.csv";
  const GEO_URL = "data/Police_Force_Areas.geojson";

  const META_COLS = new Set(["Territory Code", "Area", "Region", "Police Force Area"]);

  class CrimeChoropleth {
    constructor(containerId) {
      this.containerId = containerId;

      this.margin = { top: 10, right: 10, bottom: 10, left: 10 };
      this.width = 800;
      this.height = 520;

      this.root = d3.select(`#${containerId}`);

      this.svgEl = this.root.append("svg")
        .attr("class", "choropleth-svg");

      this.g = this.svgEl.append("g").attr("class", "choropleth-layer");

      // Projection/path
      this.projection = d3.geoMercator();
      this.path = d3.geoPath(this.projection);

      // Tooltip
      this.tooltip = d3.select("body")
        .append("div")
        .attr("class", "map-tooltip")
        .style("opacity", 0);

      // Data
      this.rows = [];     // cleaned CSV rows
      this.geo = null;    // geojson
      this.metrics = [];  // crime columns

      // Controls
      this.regionSelect = document.getElementById("map-region-filter");
      this.territorySelect = document.getElementById("map-territory-filter");
      this.metricSelect = document.getElementById("map-crime-filter");

      this.setupEvents();
      this.setupResize();
    }

    setupEvents() {
      if (this.regionSelect) {
        this.regionSelect.addEventListener("change", () => {
          this.updateTerritoryOptions();
          this.render();
        });
      }

      if (this.territorySelect) {
        this.territorySelect.addEventListener("change", () => this.render());
      }

      if (this.metricSelect) {
        this.metricSelect.addEventListener("change", () => this.render());
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
      const fullH = Math.max(420, Math.min(window.innerHeight * 0.70, 650));

      this.width = fullW - this.margin.left - this.margin.right;
      this.height = fullH - this.margin.top - this.margin.bottom;

      this.svgEl
        .attr("width", fullW)
        .attr("height", fullH);

      this.g.attr("transform", `translate(${this.margin.left},${this.margin.top})`);

      if (this.geo) {
        this.projection.fitSize([this.width, this.height], this.geo);
      }
    }

    // ---- Data loading ----
    async load() {
      const utils = window.DashboardUtils;

      const [csv, geo] = await Promise.all([
        d3.csv(CSV_URL),
        d3.json(GEO_URL)
      ]);

      this.geo = geo;

      // Decide metric columns from CSV header
      const cols = csv.columns || Object.keys(csv[0] || {});
      this.metrics = cols.filter(c => !META_COLS.has(c));

      // Clean rows and parse metrics
      this.rows = csv.map(r => {
        const row = {
          territoryCode: utils.cleanText(r["Territory Code"]),
          policeForceArea: utils.cleanText(r["Police Force Area"]),
          region: utils.cleanText(r["Region"])
        };

        this.metrics.forEach(m => {
          row[m] = utils.toNum(r[m], 0);
        });

        return row;
      });

      // Populate dropdowns
      this.populateMetricOptions();
      this.populateRegionOptions();
      this.updateTerritoryOptions();

      // Initial size/fit
      this.resize();
    }

    // ---- Controls population ----
    populateMetricOptions() {
      if (!this.metricSelect) return;

      // Keep first option "All Crime Types" (value="All") from HTML
      this.metricSelect.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());

      // Put "Total recorded crime" first if present
      const ordered = this.metrics.slice();
      const totalIdx = ordered.indexOf("Total recorded crime");
      if (totalIdx > 0) {
        ordered.splice(totalIdx, 1);
        ordered.unshift("Total recorded crime");
      }

      ordered.forEach(metric => {
        const opt = document.createElement("option");
        opt.value = metric;
        opt.textContent = metric;
        this.metricSelect.appendChild(opt);
      });

      // Default selection
      if (ordered.includes("Total recorded crime")) {
        this.metricSelect.value = "Total recorded crime";
      }
    }

    populateRegionOptions() {
      if (!this.regionSelect) return;

      // Keep first option "All Regions" (value="All") from HTML
      this.regionSelect.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());

      const regions = Array.from(new Set(this.rows.map(r => r.region)))
        .filter(Boolean)
        .sort(d3.ascending);

      regions.forEach(region => {
        const opt = document.createElement("option");
        opt.value = region;
        opt.textContent = region;
        this.regionSelect.appendChild(opt);
      });
    }

    updateTerritoryOptions() {
      if (!this.territorySelect) return;
      const selectedRegion = this.getSelectedRegion();

      // Keep first option "All Police Force Areas" (value="All") from HTML
      this.territorySelect.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());

      const utils = window.DashboardUtils;
      const regionIsAll = utils.isAll(selectedRegion);

      const territories = Array.from(new Set(
        this.rows
          .filter(r => regionIsAll || r.region === selectedRegion)
          .map(r => r.policeForceArea)
      ))
        .filter(Boolean)
        .sort(d3.ascending);

      territories.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        this.territorySelect.appendChild(opt);
      });

      // Reset to All when region changes (simpler user experience)
      this.territorySelect.value = "All";
    }

    // ---- Selected values ----
    getSelectedRegion() {
      return this.regionSelect ? this.regionSelect.value : "All";
    }

    getSelectedTerritory() {
      return this.territorySelect ? this.territorySelect.value : "All";
    }

    getSelectedMetric() {
      // If user leaves it as "All", treat as Total recorded crime (most sensible)
      if (!this.metricSelect) return "Total recorded crime";
      const v = this.metricSelect.value;
      const utils = window.DashboardUtils;
      return utils.isAll(v) ? "Total recorded crime" : v;
    }

    // ---- Rendering ----
    render() {
      if (!this.geo || this.rows.length === 0) return;

      const utils = window.DashboardUtils;
      const formatNumber = (n) => (window.d3 && d3.format ? d3.format(",")(n) : String(n));

      const selectedRegion = this.getSelectedRegion();
      const selectedTerritory = this.getSelectedTerritory();
      const metric = this.getSelectedMetric();

      const regionIsAll = utils.isAll(selectedRegion);
      const territoryIsAll = utils.isAll(selectedTerritory);

      // Build lookup by territory code (PFA23CD)
      // Filter rows by selected region and territory name
      const filtered = this.rows.filter(r =>
        (regionIsAll || r.region === selectedRegion) &&
        (territoryIsAll || r.policeForceArea === selectedTerritory)
      );

      const valueByCode = new Map();
      filtered.forEach(r => valueByCode.set(r.territoryCode, r[metric] || 0));

      // If user filtered to one police force area, we still show the full map,
      // but only that area is colored strongly. Others become greyed.
      const showOnlyOne = !territoryIsAll;

      // Compute domain for color scale from filtered rows (not entire dataset)
      const values = filtered.map(r => r[metric] || 0);
      const maxVal = d3.max(values) || 0;

      const color = d3.scaleQuantize()
        .domain([0, maxVal || 1])
        .range(d3.schemeBlues[7]);

      // Draw
      const features = this.geo.features || [];

      const paths = this.g.selectAll(".pfa")
        .data(features, d => d.properties && d.properties.PFA23CD);

      paths.exit().remove();

      const entered = paths.enter()
        .append("path")
        .attr("class", "pfa")
        .attr("d", this.path)
        .on("mousemove", (event, d) => this.onHover(event, d, metric, valueByCode))
        .on("mouseout", () => this.hideTooltip());

      entered.merge(paths)
        .attr("d", this.path)
        .attr("fill", d => {
          const code = d.properties ? d.properties.PFA23CD : "";
          const val = valueByCode.get(code);

          if (showOnlyOne) {
            // Selected territory is the only one with a value in the map lookup
            // Everything else should be muted.
            return val === undefined ? "#e6e6e6" : color(val);
          }

          return val === undefined ? "#e6e6e6" : color(val);
        })
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1);

      // Optional: add an outline of the selected area by thicker stroke
      if (showOnlyOne) {
        entered.merge(paths)
          .attr("stroke-width", d => {
            const name = d.properties ? d.properties.PFA23NM : "";
            return name === selectedTerritory ? 2.2 : 1;
          })
          .attr("stroke", d => {
            const name = d.properties ? d.properties.PFA23NM : "";
            return name === selectedTerritory ? "#2c3e50" : "#ffffff";
          });
      } else {
        entered.merge(paths)
          .attr("stroke-width", 1)
          .attr("stroke", "#ffffff");
      }
    }

    onHover(event, feature, metric, valueByCode) {
      const props = feature.properties || {};
      const code = props.PFA23CD;
      const name = props.PFA23NM || "Unknown area";
      const val = valueByCode.get(code);

      this.tooltip
        .style("opacity", 1)
        .html(`
          <div class="map-tooltip-title"><strong>${name}</strong></div>
          <div><strong>Metric:</strong> ${metric}</div>
          <div><strong>Value:</strong> ${val === undefined ? "N/A" : d3.format(",")(val)}</div>
        `)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 30}px`);
    }

    hideTooltip() {
      this.tooltip.style("opacity", 0);
    }
  }

  // ---- Bootstrap ----
  document.addEventListener("DOMContentLoaded", async () => {
    const map = new CrimeChoropleth("choropleth");
    await map.load();
    map.render();
  });
})();
