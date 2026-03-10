import type { Season } from "./types";

export function getISOWeekInfo(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return { year: utcDate.getUTCFullYear(), week: weekNo };
}

export function formatWeekRange(startDate: Date, endDate: Date) {
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

export function getSeason(dateStr: string): Season {
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
