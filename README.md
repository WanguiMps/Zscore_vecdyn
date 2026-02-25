## Zscore_vecdyn

A small system that turns raw weekly data into an easy visual story of where and when unusual changes happened.

### What it does
- Upload a CSV in the browser.
- Drop rows with blank/null `species`.
- Filter by selected species.
- Aggregate data weekly per `sample_location` (ISO year/week).
- Compute weekly z-scores per location.
- Visualize results on an animated map and a weekly line graph.

### Visualization
- Map view (Leaflet): weekly animation, season colors, expandable map.
- Line graph view: weekly z-score trend with season colors and gaps for missing weeks.

### Run locally
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Tech stack
- Next.js
- React
- TypeScript
- React Leaflet
- PapaParse

### Project structure
- `app/page.tsx` - upload, filtering, weekly processing, line chart
- `app/MapComponent.tsx` - animated map visualization
- `app/globals.css` - app styling
