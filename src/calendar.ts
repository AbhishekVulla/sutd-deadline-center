import { DeadlineItem, Settings } from './types';

export function generateICS(deadline: DeadlineItem, settings: Settings): string {
  const dueDate = new Date(deadline.due_at_iso);
  
  const startDate = formatICSDate(dueDate);
  const endDate = formatICSDate(new Date(dueDate.getTime() + 15 * 60 * 1000));
  
  const alarms: string[] = [];
  if (settings.reminders.hours_48) {
    alarms.push(createAlarm(48 * 60));
  }
  if (settings.reminders.hours_24) {
    alarms.push(createAlarm(24 * 60));
  }
  if (settings.reminders.hours_2) {
    alarms.push(createAlarm(2 * 60));
  }
  
  // Format clean description with structured info
  const formattedDate = dueDate.toLocaleString('en-SG', {
    timeZone: settings.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  const description = [
    `Course: ${deadline.course}`,
    `Type: ${deadline.type}`,
    `Due: ${formattedDate} (${settings.timezone})`,
    `Source: ${deadline.source}`,
    `Link: ${deadline.source_url}`
  ].join('\\n');
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Deadline Center//eDimension Companion//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${deadline.id}@deadline-center`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${escapeICS(deadline.title)}`,
    `LOCATION:${escapeICS(deadline.course)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `SEQUENCE:${deadline.sequence}`,
    `STATUS:CONFIRMED`,
    ...alarms,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  return icsContent;
}

function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function createAlarm(minutesBefore: number): string {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${minutesBefore / 60}h before deadline`,
    `TRIGGER:-PT${minutesBefore}M`,
    'END:VALARM'
  ].join('\r\n');
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function downloadICS(deadline: DeadlineItem, settings: Settings): void {
  const icsContent = generateICS(deadline, settings);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const filename = `${deadline.course}_${deadline.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
