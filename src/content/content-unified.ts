// Content script for the eDimension deadlines page and Gradescope course pages.
import { parseDeadlineDate, extractTermYear } from '../parsing/dateParser';
import { normalizeCourse } from '../parsing/courseNormalizer';
import { generateId } from '../parsing/hash';

const DEBUG = false; // Set to true for development logging

DEBUG && console.log('[DC] Content script injected into:', window.location.href, 'Frame:', window === window.top ? 'top' : 'iframe');

interface SimpleDeadline {
  id: string;
  course: string;
  courseRaw: string;
  courseCode?: string;
  title: string;
  type: string;
  due_at_iso: string;
  source_url: string;
  raw_text: string;
  confidence: number;
  source: 'Activity' | 'Calendar' | 'Gradescope';
  updated: boolean;
  sequence: number;
  confirmed: boolean;
  missing_time: boolean;
}

function extractCourseCode(name: string | undefined | null): string | null {
  if (!name) return null;
  const match = name.match(/\b\d{2}\.\d{3}\b/);
  return match ? match[0] : null;
}

function inferType(title: string, text: string): string {
  const lower = (title + ' ' + text).toLowerCase();
  
  if (lower.includes('homework') || lower.includes('hw')) return 'HW';
  if (lower.includes('quiz') || lower.includes('test')) return 'Quiz';
  if (lower.includes('project')) return 'Project';
  if (lower.includes('exam')) return 'Exam';
  
  return 'Other';
}

// eDimension renders the deadline cards after the page loads, so poll until they appear.
function waitForCalendarItems(timeout: number = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkSelectors = [
      '.element-card.due-item',
      '.element-card-deadline'
    ];
    
    const checkForItems = () => {
      for (const selector of checkSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          DEBUG && console.log(`[Calendar Extractor] Items appeared after ${Date.now() - startTime}ms using selector: ${selector}`);
          resolve(true);
          return;
        }
      }
      
      if (Date.now() - startTime >= timeout) {
        console.warn(`[Calendar Extractor] Timeout after ${timeout}ms - no calendar items found`);
        resolve(false);
        return;
      }
      
      setTimeout(checkForItems, 500);
    };
    
    checkForItems();
  });
}

async function parseCalendarDeadlines(): Promise<SimpleDeadline[]> {
  const deadlines: SimpleDeadline[] = [];
  
  if (!window.location.href.includes('/ultra/deadline') && 
      !window.location.href.includes('/ultra/calendar')) {
    DEBUG && console.log('[Calendar Extractor] Not on calendar/deadline page');
    return deadlines;
  }
  
  DEBUG && console.log('[Calendar Extractor] Searching for deadline items...');
  DEBUG && console.log('[Calendar Extractor] Current URL:', window.location.href);
  
  DEBUG && console.log('[Calendar Extractor] Waiting for calendar items to load...');
  const itemsAppeared = await waitForCalendarItems(15000);
  
  if (!itemsAppeared) {
    console.warn('[Calendar Extractor] No deadline items appeared, the page may be empty');
    return deadlines;
  }
  
  const detailsElements = Array.from(
    document.querySelectorAll<HTMLDivElement>('.element-card.due-item.element-card-deadline')
  );
  
  DEBUG && console.log(`[Calendar Extractor] Found ${detailsElements.length} deadline items`);
  
  if (detailsElements.length === 0) {
    DEBUG && console.log('[Calendar Extractor] No deadline items found with selector .element-card.due-item.element-card-deadline');
    return deadlines;
  }
  
  for (const [index, card] of detailsElements.entries()) {
    try {
      const titleElement = card.querySelector<HTMLAnchorElement>('.element-details .name a');
      const title = titleElement?.textContent?.trim() || '';
      
      if (!title) {
        console.warn(`[Calendar Extractor] Item ${index}: No title found, skipping`);
        continue;
      }
      
      // Revised deadlines show up as "Due date 2:", "Due date 3:" and so on.
      const contentSpans = card.querySelectorAll<HTMLSpanElement>('.element-details .content span');
      let rawDueText = '';
      for (const span of contentSpans) {
        const text = span.textContent?.trim() || '';
        const dueDateMatch = text.match(/^Due date(?:\s*\d+)?:\s*(.*)/i);
        if (dueDateMatch) {
          rawDueText = dueDateMatch[1].trim();
          break;
        }
      }
      
      if (!rawDueText) {
        console.warn(`[Calendar Extractor] Item ${index}: No due date found for "${title}", skipping`);
        continue;
      }
      
      const courseLink = card.querySelector<HTMLAnchorElement>('.element-details .content a');
      let courseRaw = 'Unknown Course';
      
      if (courseLink) {
        courseRaw = courseLink.textContent?.trim() || 'Unknown Course';
      }
      
      // Deep links to single items 404, so always link back to the deadlines page.
      const sourceUrl = 'https://edimension.sutd.edu.sg/ultra/deadline';
      
      DEBUG && console.log(`[Calendar Extractor] Item ${index} RAW DATA:`, {
        title,
        rawDueText,
        courseRaw,
        sourceUrl
      });
      
      const parsed = parseDeadlineDate(rawDueText);
      if (!parsed) {
        console.warn(`[Calendar Extractor] Item ${index}: Could not parse date "${rawDueText}"`);
        continue;
      }
      
      const course = normalizeCourse(courseRaw);
      const type = inferType(title, rawDueText);
      
      const courseCode = extractCourseCode(courseRaw);
      
      // The URL stays out of the ID so the same deadline seen on two pages is stored once.
      const id = await generateId(course, title, parsed.due_at_iso, '');
      
      const deadline: SimpleDeadline = {
        id,
        course,
        courseRaw,
        courseCode: courseCode || undefined,
        title,
        type,
        due_at_iso: parsed.due_at_iso,
        source_url: sourceUrl,
        raw_text: parsed.raw_match,
        confidence: parsed.confidence,
        source: 'Calendar',
        updated: false,
        sequence: 1,
        confirmed: false,
        missing_time: parsed.missing_time
      };
      
      DEBUG && console.log(`[Calendar Extractor] Item ${index} PROCESSED:`, {
        id: deadline.id,
        title: deadline.title,
        course: deadline.course,
        courseRaw: deadline.courseRaw,
        due_at_iso: deadline.due_at_iso,
        source_url: deadline.source_url,
        confidence: deadline.confidence,
        missing_time: deadline.missing_time
      });
      
      deadlines.push(deadline);
      
    } catch (error) {
      console.error(`[Calendar Extractor] Error parsing item ${index}:`, error);
    }
  }
  
  DEBUG && console.log(`[Calendar Extractor] Extracted ${deadlines.length} deadlines from the calendar page`);
  DEBUG && console.log('[Calendar Extractor] Full deadline array:', deadlines);
  
  return deadlines;
}

async function parseGradescopeAssignments(): Promise<SimpleDeadline[]> {
  const deadlines: SimpleDeadline[] = [];
  
  // Only a course's dashboard lists its assignments.
  const pathPattern = /\/courses\/\d+\/?$/;
  if (!pathPattern.test(window.location.pathname)) {
    DEBUG && console.log('[Gradescope Extractor] Not on Gradescope course dashboard page');
    return deadlines;
  }
  
  DEBUG && console.log('[Gradescope Extractor] Searching for assignments...');
  DEBUG && console.log('[Gradescope Extractor] Current URL:', window.location.href);
  
  const urlMatch = window.location.pathname.match(/\/courses\/(\d+)/);
  if (!urlMatch) {
    console.warn('[Gradescope Extractor] Could not extract course ID from URL');
    return deadlines;
  }
  
  const courseId = urlMatch[1];
  const courseUrl = `https://www.gradescope.com/courses/${courseId}`;
  
  // .sidebar--subtitle has the full course name, .courseHeader--title only the section code.
  const subtitleElem = document.querySelector('.sidebar--subtitle');
  const headerTitleElem = document.querySelector('.courseHeader--title');
  
  // Gradescope dates have no year, so take it from the term ("Fall 2025")
  // or from the subtitle ("2025 September Term - ...").
  const termElem = document.querySelector('.courseHeader--term');
  const termYear = extractTermYear(
    termElem?.textContent?.trim(),
    subtitleElem?.textContent?.trim()
  );
  
  if (termYear) {
    DEBUG && console.log(`[Gradescope Extractor] Extracted term year: ${termYear}`);
  } else {
    console.warn('[Gradescope Extractor] Could not extract term year from page, falling back to heuristic');
  }
  
  let courseName = subtitleElem?.textContent?.trim() || headerTitleElem?.textContent?.trim() || `Course ${courseId}`;
  
  let courseCode = extractCourseCode(subtitleElem?.textContent?.trim());
  if (!courseCode) {
    courseCode = extractCourseCode(headerTitleElem?.textContent?.trim());
  }
  
  // "2025 September Term - 10.013 : Modelling and Analysis" becomes "10.013 : Modelling and Analysis".
  const parts = courseName.split(' - ');
  if (parts.length >= 2 && /\d{4}/.test(parts[0])) {
    courseName = parts.slice(1).join(' - ').trim();
  }
  
  if (!subtitleElem && !headerTitleElem) {
    console.warn('[Gradescope Extractor] Warning: could not find course header elements (.sidebar--subtitle or .courseHeader--title)');
  }
  
  // Normalized the same way as eDimension so both sources land under one course.
  const course = normalizeCourse(courseName);
  DEBUG && console.log('[Gradescope Extractor] Course:', course, '(ID:', courseId, ', Raw:', courseName, ', Code:', courseCode, ')');
  
  const table = document.querySelector<HTMLTableElement>('table');
  if (!table) {
    DEBUG && console.log('[Gradescope Extractor] No assignment table found');
    return deadlines;
  }
  
  // Find the Due column by its header instead of assuming its position.
  const headerRow = table.querySelector<HTMLTableRowElement>('thead tr');
  let dueColumnIndex = -1;
  
  if (headerRow) {
    const headers = Array.from(headerRow.querySelectorAll<HTMLTableCellElement>('th, td'));
    for (let i = 0; i < headers.length; i++) {
      const headerText = headers[i].textContent?.toLowerCase().trim() || '';
      // "Due", "Due Date", "Due (+08)", but not "Late Due Date".
      if (headerText.includes('due') && !headerText.includes('late')) {
        dueColumnIndex = i;
        DEBUG && console.log(`[Gradescope Extractor] Found "Due" column at index ${i} (header: "${headers[i].textContent?.trim()}")`);
        break;
      }
    }
  }
  
  if (dueColumnIndex === -1) {
    console.warn('[Gradescope Extractor] Could not find "Due" column header, will try fallback logic');
  }
  
  const tableRows = Array.from(
    table.querySelectorAll<HTMLTableRowElement>('tbody tr')
  );
  
  DEBUG && console.log(`[Gradescope Extractor] Found ${tableRows.length} table rows`);
  
  if (tableRows.length === 0) {
    DEBUG && console.log('[Gradescope Extractor] No assignment rows found');
    return deadlines;
  }
  
  const now = new Date();
  
  for (const [index, row] of tableRows.entries()) {
    try {
      // Open assignments put the name in a submit button, past ones in a link.
      const nameElem = row.querySelector<HTMLElement>('th button.js-submitAssignment, th a');
      const title = nameElem?.textContent?.trim() || '';
      
      if (!title) {
        console.warn(`[Gradescope Extractor] Row ${index}: No assignment name found, skipping`);
        continue;
      }
      
      const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td'));
      
      let dueCell: HTMLTableCellElement | null = null;
      
      if (dueColumnIndex >= 0 && dueColumnIndex < cells.length) {
        dueCell = cells[dueColumnIndex];
      } else {
        // No usable header: take the first date-like cell that isn't the Released column.
        for (const cell of cells) {
          const text = cell.textContent?.trim().toLowerCase() || '';
          if (text.match(/\w{3}\s+\d{1,2}\s+at\s+\d{1,2}:\d{2}/i)) {
            const isReleasedColumn = text.includes('release') || cell.previousElementSibling?.textContent?.toLowerCase().includes('release');
            
            if (!isReleasedColumn) {
              dueCell = cell;
              DEBUG && console.log(`[Gradescope Extractor] Row ${index}: Found due date by pattern in cell: "${text}"`);
              break;
            } else {
              DEBUG && console.log(`[Gradescope Extractor] Row ${index}: Skipping Released column, continuing search...`);
            }
          }
        }
      }
      
      if (!dueCell) {
        console.warn(`[Gradescope Extractor] Row ${index}: No due date cell found for "${title}", skipping`);
        continue;
      }
      
      
      let rawDueText = '';
      let lateDueDate = '';
      
      const dueTimeElem = row.querySelector<HTMLTimeElement>('time.submissionTimeChart--dueDate');
      if (dueTimeElem) {
        rawDueText = dueTimeElem.textContent?.trim() || '';
        DEBUG && console.log(`[Gradescope Extractor] Row ${index}: Found due date: "${rawDueText}"`);
      }
      
      const lateDueTimeElem = row.querySelector<HTMLTimeElement>('time.submissionTimeChart--lateDueDate');
      if (lateDueTimeElem) {
        lateDueDate = lateDueTimeElem.textContent?.trim() || '';
        DEBUG && console.log(`[Gradescope Extractor] Row ${index}: Found late due date: "${lateDueDate}"`);
      }
      
      if (!rawDueText) {
        console.warn(`[Gradescope Extractor] Row ${index}: No time.submissionTimeChart--dueDate found for "${title}", skipping`);
        continue;
      }
      
      DEBUG && console.log(`[Gradescope Extractor] Row ${index} RAW DATA:`, {
        title,
        rawDueText,
        lateDueDate,
        course,
        termYear
      });
      
      const parsed = parseDeadlineDate(rawDueText, termYear || undefined);
      if (!parsed) {
        console.warn(`[Gradescope Extractor] Row ${index}: Could not parse date "${rawDueText}"`);
        continue;
      }
      
      const dueDate = new Date(parsed.due_at_iso);
      if (dueDate < now) {
        DEBUG && console.log(`[Gradescope Extractor] Row ${index}: Skipping past deadline "${title}" (due: ${parsed.due_at_iso})`);
        continue;
      }
      
      const type = inferType(title, rawDueText);
      
      let fullRawText = parsed.raw_match;
      if (lateDueDate) {
        fullRawText += `\nLate submissions accepted until: ${lateDueDate}`;
      }
      
      const id = await generateId(course, title, parsed.due_at_iso, '');
      
      const deadline: SimpleDeadline = {
        id,
        course,
        courseRaw: courseName,
        courseCode: courseCode || undefined,
        title,
        type,
        due_at_iso: parsed.due_at_iso,
        source_url: courseUrl,
        raw_text: fullRawText,
        confidence: parsed.confidence,
        source: 'Gradescope',
        updated: false,
        sequence: 1,
        confirmed: false,
        missing_time: parsed.missing_time
      };
      
      DEBUG && console.log(`[Gradescope Extractor] Row ${index} PROCESSED:`, {
        id: deadline.id,
        title: deadline.title,
        course: deadline.course,
        due_at_iso: deadline.due_at_iso,
        source_url: deadline.source_url
      });
      
      deadlines.push(deadline);
      
    } catch (error) {
      console.error(`[Gradescope Extractor] Error parsing row ${index}:`, error);
    }
  }
  
  DEBUG && console.log(`[Gradescope Extractor] Extracted ${deadlines.length} upcoming deadlines`);
  DEBUG && console.log('[Gradescope Extractor] Full deadline array:', deadlines);
  
  return deadlines;
}

// Merges one scrape into storage without touching other sources or other Gradescope courses.
async function saveToStorage(deadlines: SimpleDeadline[]) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.get(['deadlines'], (result) => {
      const existing = result.deadlines || [];
      
      // A single scrape always comes from one source.
      const newSource = deadlines.length > 0 ? deadlines[0].source : null;
      
      // Entries from the old activity stream scraper are dropped. Their confirmations still carry over through legacyMap.
      const existingNonActivity = existing.filter((d: SimpleDeadline) => d.source !== 'Activity');
      
      const legacyMap = new Map(existing.map((d: SimpleDeadline) => [d.id, d]));
      
      let newCourseId: string | null = null;
      if (newSource === 'Gradescope' && deadlines.length > 0) {
        const urlMatch = deadlines[0].source_url.match(/\/courses\/(\d+)/);
        if (urlMatch) {
          newCourseId = urlMatch[1];
          DEBUG && console.log(`[DC Storage] Gradescope extraction from course ${newCourseId}`);
        }
      }
      
      // Calendar and Gradescope scrapes are full snapshots, so they replace what that source had
      // (per course for Gradescope). Anything else merges by ID.
      const snapshotSources = ['Calendar', 'Gradescope'];
      const isSnapshot = newSource && snapshotSources.includes(newSource);
      
      let baseItems: SimpleDeadline[];
      if (isSnapshot) {
        baseItems = existingNonActivity.filter((d: SimpleDeadline) => {
          if (d.source !== newSource) {
            return true;
          }
          
          if (newSource === 'Gradescope' && newCourseId) {
            const existingCourseId = d.source_url.match(/\/courses\/(\d+)/)?.[1];
            return existingCourseId !== newCourseId;
          }
          
          return false;
        });
      } else {
        baseItems = existingNonActivity;
      }
      
      const mergedMap = new Map(baseItems.map((d: SimpleDeadline) => [d.id, d]));
      
      deadlines.forEach(newItem => {
        const legacyItem = legacyMap.get(newItem.id) as SimpleDeadline | undefined;
        
        if (legacyItem) {
          // Keep confirmations and the .ics SEQUENCE across rescrapes.
          newItem.confirmed = legacyItem.confirmed || newItem.confirmed;
          newItem.sequence = legacyItem.sequence;
          
          // A moved due date counts as a revision, so SEQUENCE goes up (RFC 5545).
          if (legacyItem.due_at_iso !== newItem.due_at_iso) {
            newItem.updated = true;
            newItem.sequence = (legacyItem.sequence || 1) + 1;
          }
          
          if (legacyItem.source === 'Activity' && newItem.source !== 'Activity') {
            DEBUG && console.log(`[DC] Migrating Activity to ${newItem.source}: "${newItem.title}" (confirmed=${newItem.confirmed})`);
          }
        }
        
        mergedMap.set(newItem.id, newItem);
      });
      
      const merged: SimpleDeadline[] = Array.from(mergedMap.values()) as SimpleDeadline[];
      
      const removedCount = existing.length - existingNonActivity.length;
      if (removedCount > 0) {
        DEBUG && console.log(`[DC] Storage migration: Removed ${removedCount} old Activity entries (confirmations preserved)`);
      }
      
      const sourceCounts: Record<string, number> = {};
      merged.forEach(d => {
        sourceCounts[d.source] = (sourceCounts[d.source] || 0) + 1;
      });
      
      DEBUG && console.log(`[DC] Saved ${merged.length} total deadlines:`, sourceCounts);
      
      chrome.storage.local.set({ deadlines: merged }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  });
}

async function extractAndSave() {
  DEBUG && console.log('[DC] Starting extraction...');
  const startTime = performance.now();
  const url = window.location.href;
  
  try {
    let deadlines: SimpleDeadline[] = [];
    
    if (url.includes('edimension.sutd.edu.sg')) {
      deadlines = await parseCalendarDeadlines();
    } else if (url.includes('gradescope.com/courses/')) {
      deadlines = await parseGradescopeAssignments();
    } else {
      DEBUG && console.log('[DC] Not on a supported page (eDimension or Gradescope)');
      return;
    }
    
    if (deadlines.length > 0) {
      await saveToStorage(deadlines);
      const duration = Math.round(performance.now() - startTime);
      DEBUG && console.log(`[DC] Extraction complete in ${duration}ms`);
    } else {
      DEBUG && console.log('[DC] No deadlines found on this page');
    }
  } catch (error) {
    console.error('[DC] Extraction failed:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(extractAndSave, 1000);
  });
} else {
  setTimeout(extractAndSave, 1000);
}

// eDimension is a single-page app, so scrape again when the URL changes.
let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    DEBUG && console.log('[DC] URL changed, re-extracting...');
    lastUrl = window.location.href;
    setTimeout(extractAndSave, 1000);
  }
}, 1000);
