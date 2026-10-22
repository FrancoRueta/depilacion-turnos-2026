import {
  BUSINESS_TIME_ZONE,
  DAY_CLOSE_MAX_MINUTES,
  DAY_OPEN_MINUTES,
  SLOT_MINUTES,
} from "./constants";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseDateString(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && parseDateString(value) !== null;
}

export function isValidMonthString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function timeToMinutes(time: string): number | null {
  if (!isValidTimeString(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isHalfHourTime(time: string): boolean {
  const minutes = timeToMinutes(time);
  return minutes !== null && minutes % SLOT_MINUTES === 0;
}

export function isTimeWithinBusinessWindow(time: string): boolean {
  const minutes = timeToMinutes(time);
  return minutes !== null && minutes >= DAY_OPEN_MINUTES && minutes <= DAY_CLOSE_MAX_MINUTES;
}

export function generateSlotTimes(openTime: string, closeTime: string): string[] {
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  if (open === null || close === null || open >= close) return [];

  const slots: string[] = [];
  for (let current = open; current + SLOT_MINUTES <= close; current += SLOT_MINUTES) {
    slots.push(minutesToTime(current));
  }
  return slots;
}

export function getBusinessNow(now: Date = new Date()): {
  date: string;
  time: string;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  const minutes = (timeToMinutes(time) ?? 0);
  return { date, time, minutes };
}

export function getBusinessToday(now: Date = new Date()): string {
  return getBusinessNow(now).date;
}

export function isSlotPast(
  date: string,
  time: string,
  now: Date = new Date(),
): boolean {
  const current = getBusinessNow(now);
  if (date < current.date) return true;
  if (date > current.date) return false;
  return (timeToMinutes(time) ?? 0) <= current.minutes;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function isValidDateInMonth(date: string, month: string): boolean {
  return isValidDateString(date) && date.startsWith(`${month}-`);
}

export function addMonths(month: string, delta: number): string {
  if (!isValidMonthString(month)) throw new Error("Mes inválido");
  const [year, monthNumber] = month.split("-").map(Number);
  const total = year * 12 + (monthNumber - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12 + 12) % 12 + 1;
  return `${String(newYear).padStart(4, "0")}-${String(newMonth).padStart(2, "0")}`;
}

export function monthBounds(month: string): { start: string; endExclusive: string } {
  return {
    start: `${month}-01`,
    endExclusive: `${addMonths(month, 1)}-01`,
  };
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0, 12)).getUTCDate();
}

/** Posición del primer día del mes con lunes como índice 0. */
export function firstWeekdayIndex(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthNumber - 1, 1, 12)).getUTCDay();
  return (day + 6) % 7;
}

export function dateStringFromParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function datesInMonth(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const total = daysInMonth(month);
  return Array.from({ length: total }, (_, index) =>
    dateStringFromParts(year, monthNumber, index + 1),
  );
}

export function isWeekendDate(date: string): boolean {
  const parts = parseDateString(date);
  if (!parts) return false;
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay();
  return day === 0 || day === 5 || day === 6;
}

export function weekdayIndexOf(date: string): number {
  const parts = parseDateString(date);
  if (!parts) return -1;
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay();
  return (day + 6) % 7;
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase("es-AR") + text.slice(1);
}

export function formatLongDate(date: string, includeYear = true): string {
  if (!isValidDateString(date)) return date;
  const parts = parseDateString(date)!;
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(includeYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  })
    .format(utcDate)
    .replace(/,/g, "");
}

export function formatLongDateCapitalized(date: string, includeYear = true): string {
  return capitalizeFirst(formatLongDate(date, includeYear));
}

export function formatShortDate(date: string): string {
  if (!isValidDateString(date)) return date;
  const parts = parseDateString(date)!;
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(utcDate)
    .replace(/\./g, "");
}

export function formatMonthYear(month: string): string {
  if (!isValidMonthString(month)) return month;
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1, 12));
  const text = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return capitalizeFirst(text);
}

export function formatMonthShort(month: string): string {
  if (!isValidMonthString(month)) return month;
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1, 12));
  return capitalizeFirst(
    new Intl.DateTimeFormat("es-AR", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
      .format(date)
      .replace(/\./g, ""),
  );
}

export function formatDayAndMonth(date: string): string {
  return capitalizeFirst(formatShortDate(date));
}

export function isDateBefore(first: string, second: string): boolean {
  return first < second;
}
