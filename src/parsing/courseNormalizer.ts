/**
 * Blackboard formats course names differently per page:
 *   "2530-010018: 2025 September Term - 01.018 : Design Thinking Project I"
 *   "2530-010010-Nadiah – 01.010 – Freshmore Communication Programme-Nadiah"
 * These become "01.018 – Design Thinking Project I" and
 * "01.010 – Freshmore Communication Programme-Nadiah".
 */

export function normalizeCourse(rawCourse: string): string {
  if (!rawCourse || rawCourse === 'Unknown Course') {
    return rawCourse;
  }

  let normalized = rawCourse;
  
  // Deadlines page format: "2530-XXXXXX-Name – 01.XXX – Course Name".
  const calendarMatch = normalized.match(/^2530-\d+-[^–]+–\s*(.+)$/);
  if (calendarMatch) {
    normalized = calendarMatch[1].trim();
  }
  
  // Remove leading course ID numbers for Activity format (e.g., "2530-010018: ")
  normalized = normalized.replace(/^\d+-\d+:\s*/, '');
  
  // Remove "YYYY Term - " prefix (e.g., "2025 September Term - ")
  normalized = normalized.replace(/\d{4}\s+\w+\s+Term\s+-\s*/, '');
  
  normalized = normalized.replace(/\s*:\s*/g, ' – ');
  
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Extract short course code from raw course string
 * E.g., "01.018 – Design Thinking Project I" -> "01.018"
 */
export function extractCourseCode(course: string): string {
  const match = course.match(/^(\d+\.\d+)/);
  return match ? match[1] : course;
}
