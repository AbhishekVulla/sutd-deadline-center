import { DeadlineItem, DeadlineType } from '../../types';
import { extractDeadlineFromText } from '../../parsing/dateParser';
import { generateId } from '../../parsing/hash';
import selectors from '../../config/selectors.json';

export async function extractFromAnnouncements(): Promise<DeadlineItem[]> {
  const items: DeadlineItem[] = [];
  const config = selectors.announcements;

  const containers = document.querySelectorAll(config.container);
  
  for (const container of Array.from(containers)) {
    const itemElements = container.querySelectorAll(config.items);
    
    for (const element of Array.from(itemElements)) {
      try {
        const titleEl = element.querySelector(config.title);
        const linkEl = element.querySelector(config.link);
        const courseEl = element.querySelector(config.course);
        
        if (!titleEl) continue;
        
        const title = titleEl.textContent?.trim() || '';
        const fullText = element.textContent?.trim() || '';
        const sourceUrl = linkEl instanceof HTMLAnchorElement ? linkEl.href : window.location.href;
        const course = courseEl?.textContent?.trim() || extractCourseFromTitle(title);
        
        const parsed = extractDeadlineFromText(fullText);
        if (!parsed) continue;
        
        const type = classifyType(title);
        const id = await generateId(course, title, parsed.due_at_iso, sourceUrl);
        
        items.push({
          id,
          course,
          title,
          type,
          due_at_iso: parsed.due_at_iso,
          source_url: sourceUrl,
          raw_text: fullText.substring(0, 200),
          confidence: parsed.confidence * 0.9,
          source: 'Announcement',
          updated: false,
          sequence: 1,
          confirmed: false,
          missing_time: parsed.missing_time
        });
      } catch (error) {
        console.error('Error extracting announcement item:', error);
      }
    }
  }
  
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
