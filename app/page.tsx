"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import LineGraphView from "./components/LineGraphView";
import { parseCsvFile } from "./lib/csv";
import {
  buildSpeciesOptions,
  buildTrendData,
  buildWeeklyPoints,
  getFrameCount,
  getUniqueLocationCount,
} from "./lib/processData";
import type { Row, WeeklyPoint } from "./lib/types";

const MapComponent = dynamic(() => import("./components/MapComponent"), {
  ssr: false,
});

export default function Home() {
  const [data, setData] = useState<Row[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState("ALL");
  const [viewMode, setViewMode] = useState<"map" | "line">("map");

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const cleanedRows = await parseCsvFile(file);
      setData(cleanedRows);
    } catch (error) {
      console.error("CSV parse failed", error);
    }
  };

  // Clean species list
  const speciesOptions = useMemo(() => buildSpeciesOptions(data), [data]);

  // Weekly aggregation + per-location z-score + coordinate merge
  const processedData = useMemo<WeeklyPoint[]>(
    () => buildWeeklyPoints(data, selectedSpecies),
    [data, selectedSpecies]
  );

  const frameCount = useMemo(() => getFrameCount(processedData), [processedData]);

  const uniqueLocationCount = useMemo(
    () => getUniqueLocationCount(processedData),
    [processedData]
  );

  const trendData = useMemo(() => buildTrendData(processedData), [processedData]);

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
