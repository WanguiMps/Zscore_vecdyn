"use client";

import { useState, useMemo } from "react";
import Papa, { ParseResult } from "papaparse";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
});

type Row = {
  species: string;
  sample_location: string;
  sample_end_date: string;
  sample_value: number;
  sample_lat_dd: number;
  sample_long_dd: number;
};

type WeeklyPoint = {
  sampleLocation: string;
  lat: number;
  lng: number;
  minDate: string;
  maxDate: string;
  weekRange: string;
  totalSampleValue: number;
  weeklySampleValueZscore: number;
};

type WeeklyAggregation = {
  sampleLocation: string;
  year: number;
  weekOfYear: number;
  totalSampleValue: number;
  minDate: Date;
  maxDate: Date;
};

type Season = "Spring" | "Summer" | "Autumn" | "Winter";

function getISOWeekInfo(date: Date) {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return { year: utcDate.getUTCFullYear(), week: weekNo };
}

function formatWeekRange(startDate: Date, endDate: Date) {
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = startDate.getMonth() === endDate.getMonth();

  if (sameYear && sameMonth) {
    return `${startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    })} - ${endDate.getDate()}, ${startDate.getFullYear()}`;
  }

  if (sameYear) {
    return `${startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    })} - ${endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    })}, ${startDate.getFullYear()}`;
  }

  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })} - ${endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })}`;
}

function getSeason(dateStr: string): Season {
  const monthFromIso = Number(dateStr.slice(5, 7));
  const month =
    Number.isInteger(monthFromIso) && monthFromIso >= 1 && monthFromIso <= 12
      ? monthFromIso
      : new Date(dateStr).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return "Spring";
  if (month >= 6 && month <= 8) return "Summer";
  if (month >= 9 && month <= 11) return "Autumn";
  return "Winter";
}

export default function Home() {
  const [data, setData] = useState<Row[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState("ALL");
  const [viewMode, setViewMode] = useState<"map" | "line">("map");

  // Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Row>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<Row>) => {
        const cleanedRows = results.data.filter((row) => {
          const species = row.species?.toString().trim();
          return Boolean(species);
        });
        setData(cleanedRows);
      },
    });
  };

  // Clean species list
  const speciesOptions = useMemo(() => {
    const cleaned = data
      .map((d) => d.species?.toString().trim())
      .filter((s): s is string => !!s && s.length > 0);

    return ["ALL", ...Array.from(new Set(cleaned))];
  }, [data]);

  // Weekly aggregation + per-location z-score + coordinate merge
  const processedData = useMemo<WeeklyPoint[]>(() => {
    if (!data.length) return [];

    const filtered =
      selectedSpecies === "ALL"
        ? data
        : data.filter((d) => d.species === selectedSpecies);

    const locationCoordAgg = new Map<
      string,
      { latSum: number; lngSum: number; count: number }
    >();

    const weeklyAgg = new Map<string, WeeklyAggregation>();

    filtered.forEach((row) => {
      const location = row.sample_location?.toString().trim();
      const endDate = new Date(row.sample_end_date);
      const sampleValue =
        typeof row.sample_value === "number" ? row.sample_value : NaN;
      const lat = typeof row.sample_lat_dd === "number" ? row.sample_lat_dd : NaN;
      const lng =
        typeof row.sample_long_dd === "number" ? row.sample_long_dd : NaN;

      if (!location || Number.isNaN(sampleValue) || Number.isNaN(endDate.getTime())) {
        return;
      }

      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        const coordState = locationCoordAgg.get(location) ?? {
          latSum: 0,
          lngSum: 0,
          count: 0,
        };
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

    const totalsByLocation = new Map<string, number[]>();
    weeklyRows.forEach((row) => {
      const totals = totalsByLocation.get(row.sampleLocation) ?? [];
      totals.push(row.totalSampleValue);
      totalsByLocation.set(row.sampleLocation, totals);
    });

    const statsByLocation = new Map<string, { mean: number; std: number }>();
    totalsByLocation.forEach((totals, location) => {
      const mean = totals.reduce((sum, v) => sum + v, 0) / totals.length;
      const variance =
        totals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / totals.length;
      statsByLocation.set(location, { mean, std: Math.sqrt(variance) });
    });

    const merged: WeeklyPoint[] = [];
    weeklyRows.forEach((row) => {
      const coord = locationCoordAgg.get(row.sampleLocation);
      if (!coord || coord.count === 0) return;

      const stats = statsByLocation.get(row.sampleLocation);
      if (!stats) return;

      const z =
        stats.std === 0 ? 0 : (row.totalSampleValue - stats.mean) / stats.std;

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
  }, [data, selectedSpecies]);

  const frameCount = useMemo(
    () => new Set(processedData.map((p) => p.minDate)).size,
    [processedData]
  );

  const uniqueLocationCount = useMemo(
    () => new Set(processedData.map((p) => p.sampleLocation)).size,
    [processedData]
  );

  const trendData = useMemo(() => {
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
  }, [processedData]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--page-bg)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-28 -left-16 h-80 w-80 rounded-full bg-[var(--accent-soft)] blur-3xl" />
      <div className="pointer-events-none absolute top-24 -right-20 h-96 w-96 rounded-full bg-[var(--accent-warm-soft)] blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/50 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.1)] backdrop-blur md:p-8">
          <p className="mb-3 inline-flex rounded-full border border-[var(--ink)]/15 bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink)]/70">
            VecDyn 
          </p>
          
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink)]/70 sm:text-base">
            Upload your vector dataset
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--ink)]/10 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-[var(--ink)]/55">Rows</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                {data.length.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--ink)]/10 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-[var(--ink)]/55">Locations</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                {uniqueLocationCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--ink)]/10 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-[var(--ink)]/55">Weekly Frames</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                {frameCount.toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/55 bg-white/90 p-4 shadow-[0_16px_60px_rgba(2,6,23,0.08)] backdrop-blur md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
              Upload CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {data.length > 0 && (
              <select
                value={selectedSpecies}
                onChange={(e) => setSelectedSpecies(e.target.value)}
                className="min-w-[180px] rounded-xl border border-[var(--ink)]/15 bg-white px-4 py-2.5 text-sm text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--accent)]"
              >
                {speciesOptions.map((sp, i) => (
                  <option key={`${sp}-${i}`} value={sp}>
                    {sp}
                  </option>
                ))}
              </select>
            )}

            <div className="inline-flex overflow-hidden rounded-xl border border-[var(--ink)]/15 bg-white">
              <button
                type="button"
                onClick={() => setViewMode("map")}
                className={`px-3 py-2 text-sm font-semibold transition ${
                  viewMode === "map"
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--ink)]/80 hover:bg-[var(--accent-soft)]/30"
                }`}
              >
                Map
              </button>
              <button
                type="button"
                onClick={() => setViewMode("line")}
                className={`px-3 py-2 text-sm font-semibold transition ${
                  viewMode === "line"
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--ink)]/80 hover:bg-[var(--accent-soft)]/30"
                }`}
              >
                Line Graph
              </button>
            </div>

            <div className="ml-auto text-sm text-[var(--ink)]/65">
              {processedData.length > 0
                ? `${processedData.length.toLocaleString()} weekly points mapped`
                : "Upload a CSV to generate map frames"}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/60 bg-white/92 shadow-[0_18px_80px_rgba(3,7,18,0.12)]">
          {processedData.length > 0 ? (
            viewMode === "map" ? (
              <MapComponent points={processedData} />
            ) : (
              <div className="h-[620px] w-full p-5 sm:p-8">
                <LineGraphView trendData={trendData} />
              </div>
            )
          ) : (
            <div className="flex h-[560px] flex-col items-center justify-center bg-[linear-gradient(135deg,#fff9ef_0%,#f3f8ff_100%)] px-6 text-center">
              <p className="text-lg font-semibold text-[var(--ink)]">
                No map data yet
              </p>
              <p className="mt-2 max-w-md text-sm text-[var(--ink)]/65">
                Upload a CSV file with valid species, dates, values, and
                coordinates to start the animated seasonal view.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function LineGraphView({
  trendData,
}: {
  trendData: Array<{
    date: string;
    mean: number;
    count: number;
  }>;
}) {
  if (!trendData.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--ink)]/65">
        Not enough data to build a trend line.
      </div>
    );
  }

  const width = 1000;
  const height = 500;
  const margin = { top: 24, right: 18, bottom: 60, left: 55 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const parseIsoDate = (isoDate: string) => {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  };

  const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

  const trendByDate = new Map(trendData.map((row) => [row.date, row] as const));
  const firstDate = parseIsoDate(trendData[0].date);
  const lastDate = parseIsoDate(trendData[trendData.length - 1].date);

  const fullWeeklyTrend: Array<{
    date: string;
    mean: number | null;
    count: number;
  }> = [];

  for (
    let cursor = new Date(firstDate);
    cursor <= lastDate;
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
  ) {
    const date = formatIsoDate(cursor);
    const row = trendByDate.get(date);
    fullWeeklyTrend.push(row ? row : { date, mean: null, count: 0 });
  }

  const missingWeeks = fullWeeklyTrend
    .filter((d) => d.mean === null)
    .map((d) => d.date);

  const yValues = fullWeeklyTrend
    .map((d) => d.mean)
    .filter((v): v is number => v !== null);
  const yMin = Math.min(-2.5, ...yValues);
  const yMax = Math.max(2.5, ...yValues);
  const yRange = yMax - yMin || 1;

  const xPos = (i: number) =>
    margin.left + (i / Math.max(fullWeeklyTrend.length - 1, 1)) * plotWidth;

  const yPos = (z: number) => margin.top + ((yMax - z) / yRange) * plotHeight;
  const getSeasonColor = (season: Season) => {
    if (season === "Spring") return "#2E8B57";
    if (season === "Summer") return "#E4572E";
    if (season === "Autumn") return "#D08C00";
    return "#3B82F6";
  };

  const yTicks = [-2, -1, 0, 1, 2];
  const labelDates = [
    fullWeeklyTrend[0]?.date,
    fullWeeklyTrend[Math.floor((fullWeeklyTrend.length - 1) / 2)]?.date,
    fullWeeklyTrend[fullWeeklyTrend.length - 1]?.date,
  ];

  return (
    <div className="h-full rounded-2xl border border-[var(--ink)]/10 bg-[linear-gradient(180deg,#fffef8_0%,#f6fbff_100%)] p-4 sm:p-6">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-[var(--ink)]">
          Weekly Z-Score Trend
        </h2>
        <p className="text-sm text-[var(--ink)]/65">
          Line: weekly z-score across mapped locations. Missing weeks are shown
          as gaps.
        </p>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[calc(100%-56px)] w-full">
        <rect
          x={margin.left}
          y={margin.top}
          width={plotWidth}
          height={plotHeight}
          fill="white"
          opacity={0.65}
        />

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={margin.left + plotWidth}
              y1={yPos(tick)}
              y2={yPos(tick)}
              stroke={tick === 0 ? "#64748b" : "#d8e3f0"}
              strokeDasharray={tick === 0 ? "0" : "4 5"}
            />
            <text
              x={margin.left - 10}
              y={yPos(tick) + 4}
              textAnchor="end"
              fontSize="12"
              fill="#48607a"
            >
              {tick.toFixed(0)}
            </text>
          </g>
        ))}

        {fullWeeklyTrend.slice(0, -1).map((d, i) => {
          const next = fullWeeklyTrend[i + 1];
          if (d.mean === null || next.mean === null) return null;
          const season = getSeason(d.date);
          return (
            <line
              key={`${d.date}-${next.date}`}
              x1={xPos(i)}
              y1={yPos(d.mean)}
              x2={xPos(i + 1)}
              y2={yPos(next.mean)}
              stroke={getSeasonColor(season)}
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}

        {fullWeeklyTrend.map((d, i) =>
          d.mean === null ? null : (
          <circle
            key={`${d.date}-${i}`}
            cx={xPos(i)}
            cy={yPos(d.mean)}
            r="3.2"
            fill={getSeasonColor(getSeason(d.date))}
          />
          )
        )}

        <line
          x1={margin.left}
          x2={margin.left + plotWidth}
          y1={margin.top + plotHeight}
          y2={margin.top + plotHeight}
          stroke="#8ea4bc"
        />

        <line
          x1={margin.left}
          x2={margin.left}
          y1={margin.top}
          y2={margin.top + plotHeight}
          stroke="#8ea4bc"
        />

        {labelDates.map(
          (date, idx) =>
            date && (
              <text
                key={`${date}-${idx}`}
                x={
                  idx === 0
                    ? margin.left
                    : idx === 1
                    ? margin.left + plotWidth / 2
                    : margin.left + plotWidth
                }
                y={height - 20}
                textAnchor={idx === 0 ? "start" : idx === 1 ? "middle" : "end"}
                fontSize="12"
                fill="#48607a"
              >
                {date}
              </text>
            )
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--ink)]/75">
        <span className="font-semibold text-[var(--ink)]">Season Colors:</span>
        <span style={{ color: "#2E8B57" }}>Spring</span>
        <span style={{ color: "#E4572E" }}>Summer</span>
        <span style={{ color: "#D08C00" }}>Autumn</span>
        <span style={{ color: "#3B82F6" }}>Winter</span>
      </div>
      <div className="mt-1 text-xs text-[var(--ink)]/65">
        {missingWeeks.length === 0
          ? "No missing weeks in this date range."
          : `Missing weeks (${missingWeeks.length}): ${missingWeeks
              .slice(0, 8)
              .join(", ")}${missingWeeks.length > 8 ? ", ..." : ""}`}
      </div>
    </div>
  );
}
