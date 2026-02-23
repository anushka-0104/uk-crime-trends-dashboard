
# England & Wales Crime Trends Dashboard (2020–2024)

## Overview

This project presents an interactive exploratory analysis of recorded crime data across England and Wales between 2020 and 2024.

The dashboard integrates geographic, temporal, and categorical analysis into a coordinated multi-view system built using D3.js. It allows users to explore crime patterns across regions, police force areas, and Community Safety Partnerships (CSPs), and to examine how trends evolve over time.

The goal of this project was to apply exploratory data analysis principles and communicate insights effectively through interactive visualisation.

---

## Key Features

### 1. Choropleth Map (Police Force Areas)

- GeoJSON-based map of England & Wales
- Colour-coded by selected crime metric
- Filterable by Region and Police Force Area
- Dynamic metric selection (e.g., total crime, specific categories)
- Tooltip with contextual details

**Demonstrates:**

- Spatial data joins (CSV ↔ GeoJSON)
- Quantitative colour scaling
- Multi-level filtering

---

### 2. Crime Category Bar Chart

- Displays distribution of crime types
- Filterable by Region and Police Force Area
- Sorted by frequency
- Interactive tooltips

**Demonstrates:**

- Aggregation logic
- Comparative category analysis
- Dynamic scale recalculation

---

### 3. Multi-Year Line Chart (2020–2024)

- Shows total recorded crime trends
- Region-based filtering
- Displays single region or multi-region comparison
- Responsive resizing

**Demonstrates:**

- Temporal aggregation
- Multi-dataset integration
- Trend analysis across years

---

### 4. CSP-Level Bubble Chart

- Packed bubble layout using d3.pack
- Bubble size encodes selected metric
- Filterable by Region
- Optional Top-N filtering for readability
- Interactive tooltips

**Demonstrates:**

- Hierarchical layout design
- Managing overplotting (Top-N control)
- Multi-metric analysis

---

## Dataset

The project uses publicly available crime statistics covering:

- Police Force Area totals
- Community Safety Partnership (CSP) level data
- Crime category breakdowns
- Regional classifications
- GeoJSON boundary data for Police Force Areas

Data spans 2020–2024.

Note: Values represent recorded crime counts and are not normalised by population.

---

## Technical Implementation

- D3.js v7 for all visualisation logic
- CSV parsing and dynamic aggregation
- GeoJSON integration for spatial mapping
- Coordinated filtering via shared state logic
- Responsive layout handling on window resize

Project structure:

.
├── index.html
├── data/
├── scripts/
├── styles/
└── libs/

---

## Design Decisions

- Used a coordinated multi-view dashboard rather than isolated charts
- Kept interactions simple (dropdown-based filtering) for clarity
- Avoided over-styling to prioritise readability
- Included Top-N filtering in the bubble chart to reduce clutter
- Treated the project as exploratory analysis rather than predictive modelling

---

## Limitations

- Crime counts are absolute values (not adjusted for population size)
- Reporting differences across regions are not accounted for
- The dashboard focuses on exploration rather than causal analysis

---

## What I Learned

- How to join spatial and statistical datasets in D3
- Managing state across multiple visual components
- Designing dashboards for analytical clarity
- Handling data parsing and dynamic aggregation
- The importance of data normalisation in crime analysis

---

## How to Run Locally

Because the project loads CSV and GeoJSON files using D3.js, it must be served via a local web server.

From the project root:

python -m http.server 8000

Then open:

http://localhost:8000/

---

## Future Improvements

- Add population-normalised crime rates
- Introduce time-based animation
- Implement search functionality for CSPs
- Add downloadable filtered summaries
