import { DeadlineItem, DeadlineType } from '../../types';
import { extractDeadlineFromText } from '../../parsing/dateParser';
import { generateId, normalizeTitle } from '../../parsing/hash';
import selectors from '../../config/selectors.json';

const DEBUG = false; // Set to true for development logging

export async function extractFromActivity(): Promise<DeadlineItem[]> {
  const items: DeadlineItem[] = [];
  const config = selectors.activity;

  const streamItems = document.querySelectorAll(config.items);
  DEBUG && console.log(`[Activity Extractor] Found ${streamItems.length} stream items`);
  
  for (const element of Array.from(streamItems)) {
    try {
      const courseEl = element.querySelector(config.courseLink);
      const titleEl = element.querySelector(config.titleLink);
      const dateBdiElements = element.querySelectorAll(config.dueDateBdi);
      
      if (!courseEl || !titleEl) {
        DEBUG && console.log('[Activity Extractor] Skipping item - missing course or title');
        continue;
      }
      
      const course = courseEl.textContent?.trim() || '';
      const titleRaw = titleEl.textContent?.trim() || '';
      const title = titleRaw.replace(/^Due:\s*/i, '').trim();
      
      let dateText = '';
      if (dateBdiElements.length > 0) {
        const dateBdi = dateBdiElements[0];
        const tzBdi = dateBdiElements[1];
        dateText = dateBdi.textContent?.trim() || '';
        if (tzBdi) {
          dateText += ' ' + tzBdi.textContent?.trim();
        }
      }
      
      if (!dateText) {
        DEBUG && console.log('[Activity Extractor] Skipping item - no date found:', title);
        continue;
      }
      
      DEBUG && console.log(`[Activity Extractor] Processing: "${title}" with date "${dateText}"`);
      
      const parsed = extractDeadlineFromText(dateText);
      if (!parsed) {
        DEBUG && console.log('[Activity Extractor] Failed to parse date:', dateText);
        continue;
      }
      
      const sourceUrl = (titleEl instanceof HTMLAnchorElement ? titleEl.href : null) || 
                       (courseEl instanceof HTMLAnchorElement ? courseEl.href : null) ||
                       window.location.href;
      
      const type = classifyType(title);
      const id = await generateId(course, title, parsed.due_at_iso, sourceUrl);
      
      items.push({
        id,
        course,
        title,
        type,
        due_at_iso: parsed.due_at_iso,
        source_url: sourceUrl,
        raw_text: dateText,
        confidence: parsed.confidence,
        source: 'Activity',
        updated: false,
        sequence: 1,
        confirmed: false,
        missing_time: parsed.missing_time
      });
      
      DEBUG && console.log(`[Activity Extractor] Added: "${title}" due ${parsed.due_at_iso}`);
    } catch (error) {
      console.error('[Activity Extractor] Error extracting item:', error);
    }
  }
  
  DEBUG && console.log(`[Activity Extractor] Extracted ${items.length} deadlines from Activity page`);
  return items;
}

function extractCourseFromTitle(title: string): string {
  const match = title.match(/\b([A-Z]{2,4}\s*\d{1,2}[A-Z]?)\b/);
  return match ? match[1] : 'Unknown';
}

function classifyType(title: string): DeadlineType {
  const lower = title.toLowerCase();
  const typePatterns = selectors.type_patterns;
  
  for (const [type, patterns] of Object.entries(typePatterns)) {
    if (patterns.some((p: string) => lower.includes(p.toLowerCase()))) {
      return type as DeadlineType;
    }
  }
  
  return 'Other';
}
