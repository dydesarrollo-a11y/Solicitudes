// Motor de horario hábil (espejo de src/lib/business/businessTime.ts).
// Es la FUENTE DE VERDAD de los vencimientos SLA (se ejecuta en backend).
import type {
  BusinessCalendar,
  SlaDuration,
  SlaSettings,
  TicketStatus,
  TimeStatus
} from "./types";
import { STAGE_SLA_KEY } from "./constants";

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  const hour = m.hour === 24 ? 0 : m.hour;
  const asUTC = Date.UTC(m.year!, m.month! - 1, m.day!, hour, m.minute, m.second);
  return (asUTC - date.getTime()) / 60000;
}

export function toWallClock(date: Date, timeZone: string): WallClock {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const wd: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const hour = Number(m.hour) === 24 ? 0 : Number(m.hour);
  return {
    year: Number(m.year),
    month: Number(m.month),
    day: Number(m.day),
    hour,
    minute: Number(m.minute),
    second: Number(m.second),
    weekday: wd[m.weekday ?? "Sun"] ?? 0
  };
}

function wallToInstant(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz: string
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const o = tzOffsetMinutes(new Date(guess), tz);
  const adj = guess - o * 60000;
  const o2 = tzOffsetMinutes(new Date(adj), tz);
  return new Date(guess - o2 * 60000);
}

function dateKey(w: WallClock): string {
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}
function parseHHMM(v: string): { h: number; m: number } {
  const [h, m] = v.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

export function isWorkingDay(w: WallClock, cal: BusinessCalendar): boolean {
  if (!cal.workDays.includes(w.weekday)) return false;
  const key = dateKey(w);
  if (cal.holidays.includes(key)) return false;
  if (cal.customNonWorkingDays.includes(key)) return false;
  return true;
}

function workWindow(date: Date, cal: BusinessCalendar) {
  const w = toWallClock(date, cal.timezone);
  const s = parseHHMM(cal.workStart);
  const e = parseHHMM(cal.workEnd);
  return {
    start: wallToInstant(w.year, w.month, w.day, s.h, s.m, cal.timezone),
    end: wallToInstant(w.year, w.month, w.day, e.h, e.m, cal.timezone)
  };
}

function nextWorkingDayStart(date: Date, cal: BusinessCalendar): Date {
  let c = new Date(date.getTime());
  for (let i = 0; i < 3650; i++) {
    c = new Date(c.getTime() + 86400000);
    const w = toWallClock(c, cal.timezone);
    if (isWorkingDay(w, cal)) {
      const s = parseHHMM(cal.workStart);
      return wallToInstant(w.year, w.month, w.day, s.h, s.m, cal.timezone);
    }
  }
  return c;
}

export function workdayMinutes(cal: BusinessCalendar): number {
  const s = parseHHMM(cal.workStart);
  const e = parseHHMM(cal.workEnd);
  return e.h * 60 + e.m - (s.h * 60 + s.m);
}

export function durationToBusinessMinutes(
  d: SlaDuration,
  cal: BusinessCalendar
): number {
  switch (d.unit) {
    case "minutes":
      return d.value;
    case "hours":
      return d.value * 60;
    case "businessDays":
      return d.value * workdayMinutes(cal);
    default:
      return d.value;
  }
}

export function addBusinessMinutes(
  start: Date,
  minutes: number,
  cal: BusinessCalendar
): Date {
  if (minutes <= 0) return new Date(start.getTime());
  let c = new Date(start.getTime());
  let rem = minutes;
  for (let g = 0; g < 100000; g++) {
    const w = toWallClock(c, cal.timezone);
    if (!isWorkingDay(w, cal)) {
      c = nextWorkingDayStart(c, cal);
      continue;
    }
    const { start: ds, end: de } = workWindow(c, cal);
    if (c.getTime() < ds.getTime()) {
      c = ds;
      continue;
    }
    if (c.getTime() >= de.getTime()) {
      c = nextWorkingDayStart(c, cal);
      continue;
    }
    const av = (de.getTime() - c.getTime()) / 60000;
    if (rem <= av) return new Date(c.getTime() + rem * 60000);
    rem -= av;
    c = nextWorkingDayStart(c, cal);
  }
  return c;
}

export function addBusinessDuration(
  start: Date,
  d: SlaDuration,
  cal: BusinessCalendar
): Date {
  return addBusinessMinutes(start, durationToBusinessMinutes(d, cal), cal);
}

export function businessMinutesBetween(
  a: Date,
  b: Date,
  cal: BusinessCalendar
): number {
  if (a.getTime() >= b.getTime()) return 0;
  let c = new Date(a.getTime());
  let tot = 0;
  for (let g = 0; g < 100000; g++) {
    if (c.getTime() >= b.getTime()) break;
    const w = toWallClock(c, cal.timezone);
    if (!isWorkingDay(w, cal)) {
      c = nextWorkingDayStart(c, cal);
      continue;
    }
    const { start: ds, end: de } = workWindow(c, cal);
    if (c.getTime() < ds.getTime()) {
      c = ds;
      continue;
    }
    if (c.getTime() >= de.getTime()) {
      c = nextWorkingDayStart(c, cal);
      continue;
    }
    const segEnd = Math.min(de.getTime(), b.getTime());
    tot += (segEnd - c.getTime()) / 60000;
    c = new Date(segEnd);
    if (segEnd >= de.getTime()) c = nextWorkingDayStart(c, cal);
  }
  return tot;
}

export function computeStageDueAt(
  status: TicketStatus,
  stageStart: Date,
  sla: SlaSettings,
  cal: BusinessCalendar
): Date | null {
  const key = STAGE_SLA_KEY[status];
  if (!key) return null;
  const d = sla[key];
  if (!d || typeof d !== "object" || !("value" in d)) return null;
  return addBusinessDuration(stageStart, d as SlaDuration, cal);
}

export function computeTimeStatus(
  now: Date,
  stageStart: Date | null,
  dueAt: Date | null,
  sla: SlaSettings,
  cal: BusinessCalendar
): TimeStatus {
  if (!dueAt) return "on_time";
  if (now.getTime() >= dueAt.getTime()) return "late";
  if (!stageStart) return "on_time";
  const total = businessMinutesBetween(stageStart, dueAt, cal);
  const remaining = businessMinutesBetween(now, dueAt, cal);
  if (total <= 0) return "on_time";
  if ((remaining / total) * 100 <= sla.warningThresholdPct) return "warning";
  return "on_time";
}
