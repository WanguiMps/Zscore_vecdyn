"use client";

import React, { useState } from "react";
import type { TrendPoint, Season } from "../lib/types";
import { getSeason } from "../lib/dateUtils";

export default function LineGraphView({ trendData }: { trendData: TrendPoint[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  if (!trendData.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--ink)]/65">
        Not enough data to build a trend line.
      </div>
    );
  }

  const width = 1000;
  const height = 500;
  const margin = { top: 30, right: 30, bottom: 60, left: 55 };
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

  const fullWeeklyTrend: any[] = [];
  for (
    let cursor = new Date(firstDate);
    cursor <= lastDate;
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
  ) {
    const date = formatIsoDate(cursor);
    const row = trendByDate.get(date);
    fullWeeklyTrend.push(row ? row : { date, mean: null, count: 0 });
  }

  const yValues = fullWeeklyTrend.map((d) => d.mean).filter((v): v is number => v !== null);
  const yMin = Math.min(-2.5, ...yValues);
  const yMax = Math.max(2.5, ...yValues);
  const yRange = yMax - yMin || 1;

  const xPos = (i: number) => margin.left + (i / Math.max(fullWeeklyTrend.length - 1, 1)) * plotWidth;
  const yPos = (z: number) => margin.top + ((yMax - z) / yRange) * plotHeight;

  const getSeasonColor = (season: Season) => {
    if (season === "Spring") return "#2E8B57";
    if (season === "Summer") return "#E4572E";
    if (season === "Autumn") return "#D08C00";
    return "#3B82F6";
  };

  return (
    <div className="relative h-full rounded-2xl border border-[var(--ink)]/10 bg-[linear-gradient(180deg,#fffef8_0%,#f6fbff_100%)] p-4 sm:p-6">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Weekly Trend by Year</h2>
        <p className="text-sm text-[var(--ink)]/65">
          Z-scores normalized within each annual period.
        </p>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[calc(100%-60px)] w-full overflow-visible">
        {/* Background Plot Area */}
        <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} fill="white" opacity={0.65} />

        {/* Y-Axis Grid Lines */}
        {[-2, -1, 0, 1, 2].map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left} x2={margin.left + plotWidth}
              y1={yPos(tick)} y2={yPos(tick)}
              stroke={tick === 0 ? "#64748b" : "#e2e8f0"}
              strokeDasharray={tick === 0 ? "0" : "4 4"}
            />
            <text x={margin.left - 10} y={yPos(tick) + 4} textAnchor="end" fontSize="12" fill="#64748b">
              {tick}
            </text>
          </g>
        ))}

        {/* X-Axis: Year Dividers and Labels */}
        {fullWeeklyTrend.map((d, i) => {
          const currentYear = d.date.split("-")[0];
          const previousYear = i > 0 ? fullWeeklyTrend[i - 1].date.split("-")[0] : null;

          if (currentYear !== previousYear) {
            return (
              <g key={`year-${currentYear}`}>
                <line 
                  x1={xPos(i)} x2={xPos(i)} 
                  y1={margin.top} y2={margin.top + plotHeight + 10} 
                  stroke="#cbd5e1" strokeWidth="1.5"
                />
                <text 
                  x={xPos(i) + 6} y={height - 25} 
                  fontSize="14" fontWeight="bold" fill="#1e293b"
                >
                  {currentYear}
                </text>
              </g>
            );
          }
          return null;
        })}

        {/* Trend Lines */}
        {fullWeeklyTrend.slice(0, -1).map((d, i) => {
          const next = fullWeeklyTrend[i + 1];
          if (d.mean === null || next.mean === null) return null;
          return (
            <line
              key={`${d.date}-${next.date}`}
              x1={xPos(i)} y1={yPos(d.mean)}
              x2={xPos(i + 1)} y2={yPos(next.mean)}
              stroke={getSeasonColor(getSeason(d.date))}
              strokeWidth="3.5" strokeLinecap="round"
            />
          );
        })}

        {/* Interactive Points */}
        {fullWeeklyTrend.map((d, i) => d.mean !== null && (
          <circle
            key={i}
            cx={xPos(i)} cy={yPos(d.mean)} r="4"
            fill={getSeasonColor(getSeason(d.date))}
            className="cursor-crosshair transition-all hover:r-6"
            onMouseEnter={() => setHoveredPoint({ ...d, x: xPos(i), y: yPos(d.mean) })}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}

        {/* Tooltip */}
        {hoveredPoint && (
          <g pointerEvents="none">
            <rect x={hoveredPoint.x - 55} y={hoveredPoint.y - 50} width="110" height="40" rx="6" fill="#1e293b" />
            <text x={hoveredPoint.x} y={hoveredPoint.y - 35} textAnchor="middle" fontSize="11" fill="white" fontWeight="bold">{hoveredPoint.date}</text>
            <text x={hoveredPoint.x} y={hoveredPoint.y - 20} textAnchor="middle" fontSize="11" fill="#cbd5e1">Z-Score: {hoveredPoint.mean.toFixed(2)}</text>
          </g>
        )}

        {/* Main Axes */}
        <line x1={margin.left} x2={margin.left + plotWidth} y1={margin.top + plotHeight} y2={margin.top + plotHeight} stroke="#1e293b" strokeWidth="1.5" />
        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} stroke="#1e293b" strokeWidth="1.5" />
      </svg>

      <div className="mt-4 flex gap-4 text-xs font-medium">
        {["Spring", "Summer", "Autumn", "Winter"].map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getSeasonColor(s as Season) }} />
            <span className="text-[var(--ink)]/70">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}