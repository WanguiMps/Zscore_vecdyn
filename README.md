## Zscore_vecdyn
A small system that  turns raw weekly data into an easy visual story of where and when unusual changes happened.

It’s a client-side spatiotemporal anomaly dashboard for vector data.
# Logic 
You upload a CSV in the browser.
Rows with blank/null species are dropped.
Data is optionally filtered by selected species.
Records are aggregated weekly per sample_location (ISO year/week), summing sample_value.
For each location, weekly totals are normalized to z-scores:
z=(the value -mean)/S.D
σ=0, z-score is set to 0.
Coordinates are merged per location using mean latitude/longitude.
Output per weekly-location point includes:
location, coordinates, week dates/range, total weekly value, weekly z-score.
# Visualization layer:
Map view (Leaflet):
animated by week (minDate)
marker size encodes |z-score|
marker color encodes season
supports expand/collapse fullscreen playback.
Line Graph view:
plots weekly z-score trend over time
season-colored segments/points
missing weeks are shown as gaps and also listed as missing dates.

# Run locally
npm install
npm run dev
Then open http://localhost:3000.

# Tech stack
Next.js
React
TypeScript
React Leaflet
PapaParse

# Project structure
app/page.tsx → upload, filtering, weekly processing, line chart
app/MapComponent.tsx → animated map visualization
app/globals.css → app styling
# Future improvements
Better season handling by hemisphere
