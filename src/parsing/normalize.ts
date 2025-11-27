import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export interface NormalizedDate {
  iso: string;
  missing_time: boolean;
}

export function normalizeToSingapore(
  dateStr: string,
  timeStr?: string
): NormalizedDate {
  const tz = 'Asia/Singapore';
  let missing_time = false;

  if (!timeStr) {
    missing_time = true;
    timeStr = '23:59';
  }

  const combined = `${dateStr} ${timeStr}`;
  const parsed = dayjs.tz(combined, tz);

  if (!parsed.isValid()) {
    const defaultDate = dayjs.tz(tz).endOf('day');
    return {
      iso: defaultDate.toISOString(),
      missing_time: true
    };
  }

  return {
    iso: parsed.toISOString(),
    missing_time
  };
}

export function inferYear(dateStr: string): string {
  if (/\d{4}/.test(dateStr)) {
    return dateStr;
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const monthMatch = dateStr.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (monthMatch) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = monthNames.findIndex(m => monthMatch[0].toLowerCase().startsWith(m));

    if (monthIndex >= 8 && currentMonth < 6) {
      return `${dateStr} ${currentYear - 1}`;
    } else if (monthIndex < 6 && currentMonth >= 8) {
      return `${dateStr} ${currentYear + 1}`;
    }
  }

  return `${dateStr} ${currentYear}`;
}
