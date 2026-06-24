/**
 * ─────────────────────────────────────────────────────────────
 * Cálculo de HORARIO HÁBIL (sin librerías externas).
 *
 * Reglas:
 *   - Jornada configurable (por defecto 08:00–18:00)
 *   - Días laborables L–V (configurable)
 *   - Zona horaria America/Mexico_City
 *   - Se excluyen festivos oficiales + días no laborables personalizados
 *
 * Este módulo es PURO y se comparte entre el cliente (timers) y las
 * Cloud Functions (fuente de verdad de los vencimientos SLA).
 * ─────────────────────────────────────────────────────────────
 */
import type { BusinessCalendar, SlaDuration, TimeUnit } from "@/lib/types";

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=domingo … 6=sábado
}

/** Offset (en minutos) entre la zona horaria y UTC para un instante dado. */
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
  const hour = m.hour === 24 ? 0 : m.hour; // Intl puede devolver 24
  const asUTC = Date.UTC(m.year!, m.month! - 1, m.day!, hour, m.minute, m.second);
  return (asUTC - date.getTime()) / 60000;
}

/** Componentes de reloj de pared (en la zona configurada) de un instante. */
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
  const weekdayMap: Record<string, number> = {
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
    weekday: weekdayMap[m.weekday ?? "Sun"] ?? 0
  };
}

/** Construye un instante (Date UTC) a partir de hora de pared en una zona. */
function wallToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  // Ajuste por offset (resolvemos una vez; MX ya no usa horario de verano).
  const offset = tzOffsetMinutes(new Date(guess), timeZone);
  const adjusted = guess - offset * 60000;
  // Segunda pasada por robustez ante cambios de offset.
  const offset2 = tzOffsetMinutes(new Date(adjusted), timeZone);
  return new Date(guess - offset2 * 60000);
}

function dateKey(w: WallClock): string {
  const mm = String(w.month).padStart(2, "0");
  const dd = String(w.day).padStart(2, "0");
  return `${w.year}-${mm}-${dd}`;
}

function parseHHMM(value: string): { h: number; m: number } {
  const [h, m] = value.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

/** ¿El día (reloj de pared) es laborable? */
export function isWorkingDay(w: WallClock, cal: BusinessCalendar): boolean {
  if (!cal.workDays.includes(w.weekday)) return false;
  const key = dateKey(w);
  if (cal.holidays.includes(key)) return false;
  if (cal.customNonWorkingDays.includes(key)) return false;
  return true;
}

/** Instantes de inicio/fin de jornada para el día de un instante dado. */
function workWindow(date: Date, cal: BusinessCalendar): { start: Date; end: Date } {
  const w = toWallClock(date, cal.timezone);
  const s = parseHHMM(cal.workStart);
  const e = parseHHMM(cal.workEnd);
  return {
    start: wallToInstant(w.year, w.month, w.day, s.h, s.m, cal.timezone),
    end: wallToInstant(w.year, w.month, w.day, e.h, e.m, cal.timezone)
  };
}

/** Avanza al inicio de la jornada del siguiente día laborable. */
function nextWorkingDayStart(date: Date, cal: BusinessCalendar): Date {
  let cursor = new Date(date.getTime());
  for (let i = 0; i < 3650; i++) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    const w = toWallClock(cursor, cal.timezone);
    if (isWorkingDay(w, cal)) {
      const s = parseHHMM(cal.workStart);
      return wallToInstant(w.year, w.month, w.day, s.h, s.m, cal.timezone);
    }
  }
  return cursor;
}

const MS = {
  minute: 60_000
};

/** Convierte una duración SLA a MINUTOS hábiles. */
export function durationToBusinessMinutes(
  d: SlaDuration,
  cal: BusinessCalendar
): number {
  const dayMinutes = workdayMinutes(cal);
  switch (d.unit as TimeUnit) {
    case "minutes":
      return d.value;
    case "hours":
      return d.value * 60;
    case "businessDays":
      return d.value * dayMinutes;
    default:
      return d.value;
  }
}

/** Minutos hábiles que dura una jornada completa. */
export function workdayMinutes(cal: BusinessCalendar): number {
  const s = parseHHMM(cal.workStart);
  const e = parseHHMM(cal.workEnd);
  return e.h * 60 + e.m - (s.h * 60 + s.m);
}

/**
 * Suma `minutes` MINUTOS HÁBILES a partir de `start` y devuelve el instante
 * de vencimiento. Resuelve el ejemplo del requerimiento:
 *   viernes 17:30 + 2h hábiles (jornada 8–18) → siguiente hábil 09:30.
 */
export function addBusinessMinutes(
  start: Date,
  minutes: number,
  cal: BusinessCalendar
): Date {
  if (minutes <= 0) return new Date(start.getTime());
  let cursor = new Date(start.getTime());
  let remaining = minutes;

  for (let guard = 0; guard < 100000; guard++) {
    const w = toWallClock(cursor, cal.timezone);

    if (!isWorkingDay(w, cal)) {
      cursor = nextWorkingDayStart(cursor, cal);
      continue;
    }

    const { start: dayStart, end: dayEnd } = workWindow(cursor, cal);

    if (cursor.getTime() < dayStart.getTime()) {
      cursor = dayStart;
      continue;
    }
    if (cursor.getTime() >= dayEnd.getTime()) {
      cursor = nextWorkingDayStart(cursor, cal);
      continue;
    }

    const availableMin = (dayEnd.getTime() - cursor.getTime()) / MS.minute;
    if (remaining <= availableMin) {
      return new Date(cursor.getTime() + remaining * MS.minute);
    }
    remaining -= availableMin;
    cursor = nextWorkingDayStart(cursor, cal);
  }
  return cursor;
}

/** Atajo: aplica una duración SLA y devuelve la fecha de vencimiento. */
export function addBusinessDuration(
  start: Date,
  d: SlaDuration,
  cal: BusinessCalendar
): Date {
  return addBusinessMinutes(start, durationToBusinessMinutes(d, cal), cal);
}

/**
 * Minutos hábiles entre dos instantes (a < b). Si a >= b devuelve 0.
 */
export function businessMinutesBetween(
  a: Date,
  b: Date,
  cal: BusinessCalendar
): number {
  if (a.getTime() >= b.getTime()) return 0;
  let cursor = new Date(a.getTime());
  let total = 0;

  for (let guard = 0; guard < 100000; guard++) {
    if (cursor.getTime() >= b.getTime()) break;
    const w = toWallClock(cursor, cal.timezone);

    if (!isWorkingDay(w, cal)) {
      cursor = nextWorkingDayStart(cursor, cal);
      continue;
    }
    const { start: dayStart, end: dayEnd } = workWindow(cursor, cal);

    if (cursor.getTime() < dayStart.getTime()) {
      cursor = dayStart;
      continue;
    }
    if (cursor.getTime() >= dayEnd.getTime()) {
      cursor = nextWorkingDayStart(cursor, cal);
      continue;
    }
    const segmentEnd = Math.min(dayEnd.getTime(), b.getTime());
    total += (segmentEnd - cursor.getTime()) / MS.minute;
    cursor = new Date(segmentEnd);
    if (segmentEnd >= dayEnd.getTime()) {
      cursor = nextWorkingDayStart(cursor, cal);
    }
  }
  return total;
}
