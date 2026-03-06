"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";

type Point = {
  lat: number;
  lng: number;
  sampleLocation: string;
  minDate: string;
  maxDate: string;
  weekRange: string;
  totalSampleValue: number;
  weeklySampleValueZscore: number;
};

type Season = "Spring" | "Summer" | "Autumn" | "Winter";

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

function FitBounds({ points }: { points: Point[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const bounds = L.latLngBounds(
      points.map((p) => [p.lat, p.lng] as [number, number])
    );

    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, points]);

  return null;
}

export default function MapComponent({ points }: { points: Point[] }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const frameDates = useMemo(
    () => Array.from(new Set(points.map((p) => p.minDate))).sort(),
    [points]
  );
  const safeFrameIndex = Math.min(frameIndex, Math.max(frameDates.length - 1, 0));

  useEffect(() => {
    if (!isPlaying || frameDates.length < 2) return;

    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frameDates.length);
    }, 900);

    return () => window.clearInterval(timer);
  }, [isPlaying, frameDates.length]);

  const currentDate = frameDates[safeFrameIndex] ?? "";
  const visiblePoints = useMemo(
    () => points.filter((p) => p.minDate === currentDate),
    [points, currentDate]
  );

  const center: [number, number] = [
    points[0]?.lat || 0,
    points[0]?.lng || 0,
  ];

  const getSeasonColor = (season: Season) => {
    if (season === "Spring") return "#2E8B57";
    if (season === "Summer") return "#E4572E";
    if (season === "Autumn") return "#D08C00";
    return "#3B82F6";
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isExpanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow || "";
    }

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExpanded]);

  return (
    <div
      className={
        isExpanded
          ? "fixed inset-3 z-[2000] h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_25px_120px_rgba(2,6,23,0.35)]"
          : "relative h-[620px] w-full"
      }
    >
      <div className="absolute left-3 top-3 z-[1000] max-w-[220px] rounded-xl border border-white/60 bg-white/92 p-2 text-[11px] shadow-lg backdrop-blur sm:left-4 sm:top-4 sm:max-w-[230px] sm:p-2.5">
        <div className="font-semibold text-[var(--ink)]">Weekly Z-Score Animation</div>
        <div className="mt-1 text-[var(--ink)]/70">{currentDate || "No frame"}</div>
        <div className="text-[var(--ink)]/70">
          Season: {currentDate ? getSeason(currentDate) : "N/A"}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            className="rounded-md border border-[var(--ink)]/15 bg-white px-2 py-0.5 font-semibold text-[var(--ink)]/80 hover:bg-[var(--accent-soft)]/30"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(frameDates.length - 1, 0)}
            value={safeFrameIndex}
            onChange={(e) => {
              setFrameIndex(Number(e.target.value));
              setIsPlaying(false);
            }}
            className="w-28 accent-[var(--accent)] sm:w-32"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-2 w-full rounded-md border border-[var(--ink)]/15 bg-white px-2 py-1 text-[11px] font-semibold text-[var(--ink)]/85 hover:bg-[var(--accent-soft)]/30"
        >
          {isExpanded ? "Collapse Map (Esc)" : "Expand Map"}
        </button>
      </div>

      <MapContainer center={center} zoom={6} className="h-full w-full">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={points} />
        <InvalidateSize trigger={`${isExpanded}-${safeFrameIndex}-${visiblePoints.length}`} />

        {visiblePoints.map((p) => {
          const season = getSeason(p.minDate);
          return (
          <CircleMarker
            key={`${p.sampleLocation}-${p.minDate}`}
            center={[p.lat, p.lng]}
            radius={Math.min(18, Math.abs(p.weeklySampleValueZscore) * 4 + 5)}
            pathOptions={{
              color: getSeasonColor(season),
              fillColor: getSeasonColor(season),
              fillOpacity: 0.85,
            }}
          >
            <Tooltip>
              <div className="space-y-1">
                <div className="font-semibold">{p.sampleLocation}</div>
                <div>Season: {season}</div>
                <div>Week: {p.weekRange}</div>
                <div>Total: {p.totalSampleValue.toFixed(2)}</div>
                <div>Z-score: {p.weeklySampleValueZscore.toFixed(2)}</div>
              </div>
            </Tooltip>
          </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="absolute bottom-3 right-3 z-[1000] rounded-2xl border border-white/60 bg-white/92 p-3 text-xs shadow-lg backdrop-blur sm:bottom-4 sm:right-4">
        <div className="mb-1 font-semibold text-[var(--ink)]">Seasons</div>
        <div className="space-y-1">
          <div style={{ color: "#2E8B57" }}>Spring</div>
          <div style={{ color: "#E4572E" }}>Summer</div>
          <div style={{ color: "#D08C00" }}>Autumn</div>
          <div style={{ color: "#3B82F6" }}>Winter</div>
        </div>
      </div>
    </div>
  );
}

function InvalidateSize({ trigger }: { trigger: string }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [map, trigger]);

  return null;
}
