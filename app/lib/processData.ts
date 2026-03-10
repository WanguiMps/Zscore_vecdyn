import type { Row, WeeklyAggregation, WeeklyPoint, TrendPoint } from "./types";
import { formatWeekRange, getISOWeekInfo } from "./dateUtils";

export function buildSpeciesOptions(data: Row[]) {
  const cleaned = data
    .map((d) => d.species?.toString().trim())
    .filter((s): s is string => !!s && s.length > 0);

  return ["ALL", ...Array.from(new Set(cleaned))];
}

export function buildWeeklyPoints(data: Row[], selectedSpecies: string): WeeklyPoint[] {
  if (!data.length) return [];

  const filtered =
    selectedSpecies === "ALL"
      ? data
      : data.filter((d) => d.species === selectedSpecies);

  const locationCoordAgg = new Map<string, { latSum: number; lngSum: number; count: number }>();
  const weeklyAgg = new Map<string, WeeklyAggregation>();

  // 1. Initial Aggregation (Raw Values by Week/Location)
  filtered.forEach((row) => {
    const location = row.sample_location?.toString().trim();
    const endDate = new Date(row.sample_end_date);
    const sampleValue = typeof row.sample_value === "number" ? row.sample_value : NaN;
    const lat = typeof row.sample_lat_dd === "number" ? row.sample_lat_dd : NaN;
    const lng = typeof row.sample_long_dd === "number" ? row.sample_long_dd : NaN;

    if (!location || Number.isNaN(sampleValue) || Number.isNaN(endDate.getTime())) {
      return;
    }

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const coordState = locationCoordAgg.get(location) ?? { latSum: 0, lngSum: 0, count: 0 };
      coordState.latSum += lat;
      coordState.lngSum += lng;
      coordState.count += 1;
      locationCoordAgg.set(location, coordState);
    }

    const { year, week } = getISOWeekInfo(endDate);
    const key = `${location}__${year}__${week}`;
    const current = weeklyAgg.get(key);

    if (!current) {
      weeklyAgg.set(key, {
        sampleLocation: location,
        year,
        weekOfYear: week,
        totalSampleValue: sampleValue,
        minDate: endDate,
        maxDate: endDate,
      });
    } else {
      current.totalSampleValue += sampleValue;
      if (endDate < current.minDate) current.minDate = endDate;
      if (endDate > current.maxDate) current.maxDate = endDate;
    }
  });

  const weeklyRows = Array.from(weeklyAgg.values());
  if (!weeklyRows.length) return [];

  // 2. Group all weekly totals by Location AND Year (The "Mean Inside Each Year")
  const totalsByLocYear = new Map<string, number[]>();
  weeklyRows.forEach((row) => {
    const locYearKey = `${row.sampleLocation}__${row.year}`;
    const totals = totalsByLocYear.get(locYearKey) ?? [];
    totals.push(row.totalSampleValue);
    totalsByLocYear.set(locYearKey, totals);
  });

  // 3. Calculate Mean and Standard Deviation for every Location-Year context
  const statsByLocYear = new Map<string, { mean: number; std: number }>();
  totalsByLocYear.forEach((totals, locYearKey) => {
    const mean = totals.reduce((sum, v) => sum + v, 0) / totals.length;
    const variance = totals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / totals.length;
    statsByLocYear.set(locYearKey, { 
      mean, 
      std: Math.sqrt(variance) 
    });
  });

  // 4. Merge data and apply the Yearly Z-Score
  const merged: WeeklyPoint[] = [];
  weeklyRows.forEach((row) => {
    const coord = locationCoordAgg.get(row.sampleLocation);
    if (!coord || coord.count === 0) return;

    // Use the combined key to fetch the local yearly mean/std
    const locYearKey = `${row.sampleLocation}__${row.year}`;
    const stats = statsByLocYear.get(locYearKey);
    if (!stats) return;

    // Z-Score calculation using the mean of THIS year only
    const z = stats.std === 0 ? 0 : (row.totalSampleValue - stats.mean) / stats.std;

    merged.push({
      sampleLocation: row.sampleLocation,
      lat: coord.latSum / coord.count,
      lng: coord.lngSum / coord.count,
      minDate: row.minDate.toISOString().slice(0, 10),
      maxDate: row.maxDate.toISOString().slice(0, 10),
      weekRange: formatWeekRange(row.minDate, row.maxDate),
      totalSampleValue: row.totalSampleValue,
      weeklySampleValueZscore: z,
    });
  });

  return merged.sort((a, b) => {
    if (a.minDate !== b.minDate) return a.minDate.localeCompare(b.minDate);
    return a.sampleLocation.localeCompare(b.sampleLocation);
  });
}

export function buildTrendData(processedData: WeeklyPoint[]): TrendPoint[] {
  const grouped = new Map<string, number[]>();

  processedData.forEach((point) => {
    const values = grouped.get(point.minDate) ?? [];
    values.push(point.weeklySampleValueZscore);
    grouped.set(point.minDate, values);
  });

  return Array.from(grouped.entries())
    .map(([date, values]) => {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      return { date, mean, count: values.length };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getFrameCount(points: WeeklyPoint[]) {
  return new Set(points.map((p) => p.minDate)).size;
}

export function getUniqueLocationCount(points: WeeklyPoint[]) {
  return new Set(points.map((p) => p.sampleLocation)).size;
}