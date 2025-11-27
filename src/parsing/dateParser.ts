import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { normalizeToSingapore, inferYear } from './normalize';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export interface ParsedDate {
  due_at_iso: string;
  confidence: number;
  missing_time: boolean;
  raw_match: string;
}

const DATE_PATTERNS = [
  // V2: "Nov 17 at 8:00PM" - Gradescope format (month day at time)
  {
    regex: /(\w{3,9})\s+(\d{1,2})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i,
    confidence: 0.95,
    format: 'MMM D h:mm A'
  },
  // "11/10/25, 11:59 PM (UTC+8)" - M/D/YY with 12-hour time and comma
  {
    regex: /(\d{1,2})\/(\d{1,2})\/(\d{2}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i,
    confidence: 0.95,
    format: 'M/D/YY, h:mm A'
  },
  // "11/10/25 6:00 PM" - M/D/YY with 12-hour time, optional comma
  {
    regex: /(\d{1,2})\/(\d{1,2})\/(\d{2}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i,
    confidence: 0.9,
    format: 'M/D/YY h:mm A'
  },
  // "Fri, 24 Oct 2025, 23:59 (UTC+8)"
  {
    regex: /(\w{3},?\s+)?(\d{1,2})\s+(\w{3,9})\s+(\d{4})[,\s]+(\d{1,2}):(\d{2})/i,
    confidence: 0.95,
    format: 'D MMM YYYY HH:mm',
    stripWeekday: true
  },
  // "24 Oct 2025 23:59" or "24 Oct 23:59"
  {
    regex: /(\d{1,2})\s+(\w{3,9})\s+(?:(\d{4})\s+)?(\d{1,2}):(\d{2})/i,
    confidence: 0.9,
    format: 'D MMM YYYY HH:mm'
  },
  // "Mon 6 Oct 0900" or "Mon 6 Oct, 0900"
  {
    regex: /(\w{3})\s+(\d{1,2})\s+(\w{3,9})[,\s]+(\d{4})/i,
    confidence: 0.9,
    format: 'D MMM HHmm',
    isTimeOnly: true
  },
  // "31/10/2025 23:59" or "31/10/2025"
  {
    regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/,
    confidence: 0.85,
    format: 'DD/MM/YYYY HH:mm'
  },
  // "10 Nov 11:59 PM"
  {
    regex: /(\d{1,2})\s+(\w{3,9})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i,
    confidence: 0.9,
    format: 'D MMM h:mm A'
  },
  // "13 Nov Thu 15:30–17:00" (time range, pick end time)
  {
    regex: /(\d{1,2})\s+(\w{3,9})\s+(\w{3})\s+(\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2})/i,
    confidence: 0.9,
    format: 'D MMM HH:mm',
    useEndTime: true
  },
  // "closes 21:00 on 5 Nov" or "opens 09:00, closes 21:00 on 5 Nov"
  {
    regex: /closes?\s+(\d{1,2}):(\d{2})\s+on\s+(\d{1,2})\s+(\w{3,9})/i,
    confidence: 0.85,
    format: 'D MMM HH:mm'
  },
  // "Fri 24 Oct 2025" (date only, no time)
  {
    regex: /(\w{3})\s+(\d{1,2})\s+(\w{3,9})\s+(\d{4})/i,
    confidence: 0.75,
    format: 'D MMM YYYY',
    dateOnly: true
  },
  // "24 Oct 2025" (date only)
  {
    regex: /(\d{1,2})\s+(\w{3,9})\s+(\d{4})/i,
    confidence: 0.75,
    format: 'D MMM YYYY',
    dateOnly: true
  },
  // "Sat 13 Dec" (date only, no year)
  {
    regex: /(\w{3})\s+(\d{1,2})\s+(\w{3,9})(?!\s+\d{4})/i,
    confidence: 0.65,
    format: 'D MMM',
    dateOnly: true,
    needsYear: true
  }
];

export function parseDeadlineDate(text: string): ParsedDate | null {
  text = text.replace(/\(UTC\+8\)/gi, '').trim();

  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern.regex);
    if (!match) continue;

    try {
      let dateStr = match[0];

      if (pattern.stripWeekday) {
        dateStr = dateStr.replace(/^\w{3},?\s+/, '');
      }
      
      if (pattern.useEndTime && match[6] && match[7]) {
        const day = match[1];
        const month = match[2];
        const endHour = match[6];
        const endMin = match[7];
        dateStr = `${day} ${month} ${endHour}:${endMin}`;
      } else if (pattern.isTimeOnly) {
        const day = match[2];
        const month = match[3];
        const time = match[4];
        const formattedTime = time.length === 4 ? `${time.slice(0, 2)}:${time.slice(2)}` : time;
        dateStr = `${day} ${month} ${formattedTime}`;
      } else if (pattern.regex.source.includes('closes')) {
        const closeMatch = text.match(/closes?\s+(\d{1,2}):(\d{2})\s+on\s+(\d{1,2})\s+(\w{3,9})/i);
        if (closeMatch) {
          dateStr = `${closeMatch[3]} ${closeMatch[4]} ${closeMatch[1]}:${closeMatch[2]}`;
        }
      }

      if (pattern.needsYear) {
        dateStr = inferYear(dateStr);
      }

      if (pattern.dateOnly) {
        const normalized = normalizeToSingapore(dateStr);
        return {
          due_at_iso: normalized.iso,
          confidence: pattern.confidence,
          missing_time: true,
          raw_match: match[0]
        };
      }

      let parsedDate = dayjs.tz(dateStr, pattern.format, 'Asia/Singapore');
      
      if (!parsedDate.isValid() && !pattern.needsYear) {
        dateStr = inferYear(dateStr);
        parsedDate = dayjs.tz(dateStr, pattern.format, 'Asia/Singapore');
      }

      if (parsedDate.isValid()) {
        return {
          due_at_iso: parsedDate.toISOString(),
          confidence: pattern.confidence,
          missing_time: pattern.dateOnly || false,
          raw_match: match[0]
        };
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

export function extractDeadlineFromText(text: string): ParsedDate | null {
  const keywords = ['due', 'deadline', 'submit by', 'closes', 'by 23:59', '11:59 PM'];
  const hasKeyword = keywords.some(kw => text.toLowerCase().includes(kw));
  
  const parsed = parseDeadlineDate(text);
  if (!parsed) return null;

  if (hasKeyword) {
    parsed.confidence = Math.min(parsed.confidence + 0.1, 1.0);
  } else {
    parsed.confidence = Math.max(parsed.confidence - 0.15, 0.3);
  }

  return parsed;
}
