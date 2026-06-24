/**
 * Pruebas mínimas del motor de horario hábil (ejecutar: npm run test:business).
 * No requiere framework: usa assert de Node.
 */
import assert from "node:assert";
import { DEFAULT_CALENDAR } from "./constants";
import {
  addBusinessMinutes,
  businessMinutesBetween,
  toWallClock
} from "./businessTime";

const cal = { ...DEFAULT_CALENDAR, holidays: [], customNonWorkingDays: [] };
const TZ = cal.timezone;

function wall(d: Date) {
  return toWallClock(d, TZ);
}

// Helper: construir un instante a partir de hora local MX (offset fijo -06:00).
function mx(y: number, mo: number, d: number, h: number, mi: number): Date {
  return new Date(Date.UTC(y, mo - 1, d, h + 6, mi));
}

let passed = 0;

// 1) Ejemplo del requerimiento: viernes 17:30 + 2h hábiles → lunes 09:30
{
  // 2026-06-26 es viernes
  const start = mx(2026, 6, 26, 17, 30);
  const due = addBusinessMinutes(start, 120, cal);
  const w = wall(due);
  assert.strictEqual(w.weekday, 1, "Debe caer en lunes");
  assert.strictEqual(w.hour, 9, "Hora 09");
  assert.strictEqual(w.minute, 30, "Minuto 30");
  passed++;
}

// 2) Dentro de la misma jornada: lunes 09:00 + 3h → lunes 12:00
{
  const start = mx(2026, 6, 29, 9, 0); // lunes
  const due = addBusinessMinutes(start, 180, cal);
  const w = wall(due);
  assert.strictEqual(w.day, 29);
  assert.strictEqual(w.hour, 12);
  passed++;
}

// 3) businessMinutesBetween de una jornada completa = 600 min (10h)
{
  const a = mx(2026, 6, 29, 8, 0);
  const b = mx(2026, 6, 29, 18, 0);
  assert.strictEqual(businessMinutesBetween(a, b, cal), 600);
  passed++;
}

// 4) Fin de semana no cuenta: viernes 17:00 + 2h → lunes 09:00
{
  const start = mx(2026, 6, 26, 17, 0);
  const due = addBusinessMinutes(start, 120, cal);
  const w = wall(due);
  assert.strictEqual(w.weekday, 1, "lunes");
  assert.strictEqual(w.hour, 9);
  passed++;
}

console.log(`✓ businessTime: ${passed}/4 pruebas OK`);
