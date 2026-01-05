// Unified content script for eDimension (Activity Stream + Calendar) + Gradescope
import { parseDeadlineDate, extractTermYear } from '../parsing/dateParser';
import { normalizeCourse } from '../parsing/courseNormalizer';
import { generateId } from '../parsing/hash';

console.log('[DC] Content script injected into:', window.location.href, 'Frame:', window === window.top ? 'top' : 'iframe');

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

// Extract SUTD course code (XX.XXX) from course name string
function extractCourseCode(name: string | undefined | null): string | null {
  if (!name) return null;
  const match = name.match(/\b\d{2}\.\d{3}\b/);
  return match ? match[0] : null;
}

// Determine deadline type from keywords
function inferType(title: string, text: string): string {
  const lower = (title + ' ' + text).toLowerCase();
  
  if (lower.includes('homework') || lower.includes('hw')) return 'HW';
  if (lower.includes('quiz') || lower.includes('test')) return 'Quiz';
  if (lower.includes('project')) return 'Project';
  if (lower.includes('exam')) return 'Exam';
  
  return 'Other';
}

// Parse Activity Stream page
async function parseActivityStream(): Promise<SimpleDeadline[]> {
  const deadlines: SimpleDeadline[] = [];
  
  if (!window.location.pathname.includes('/ultra/stream')) {
    console.log('[Activity Extractor] Not on stream page');
    return deadlines;
  }
  
  console.log('[Activity Extractor] Searching for stream items...');
  
  const selectors = [
    'li.stream-item-container',
    '.js-stream-item',
    '[role="article"]',
    '.activity-stream-item'
  ];
  
  let items: Element[] = [];
  for (const selector of selectors) {
    items = Array.from(document.querySelectorAll(selector));
    if (items.length > 0) {
      console.log(`[Activity Extractor] Found ${items.length} items with selector: ${selector}`);
      break;
    }
  }
  
  if (items.length === 0) {
    console.log('[Activity Extractor] No stream items found');
    return deadlines;
  }
  
  // Use for...of instead of forEach to support await
  for (const [index, item] of items.entries()) {
    try {
      const titleElement = item.querySelector('h3, h4, .item-title, .activity-title, [class*="title"]');
      const title = titleElement?.textContent?.trim() || '';
      
      if (!title) continue;
      
      const courseElement = item.querySelector('.course-title, .course-name, [class*="course"]');
      let courseRaw = courseElement?.textContent?.trim() || 'Unknown Course';
      
      if (courseRaw === 'Unknown Course' && title.includes(' - ')) {
        const parts = title.split(' - ');
        if (parts.length >= 2) courseRaw = parts[0].trim();
      }
      
      const fullText = item.textContent || '';
      
      // Use shared parseDeadlineDate utility for proper timezone handling
      const parsed = parseDeadlineDate(fullText);
      if (!parsed) {
        console.log(`[Activity Extractor] No date found for: ${title}`);
        continue;
      }
      
      const course = normalizeCourse(courseRaw);
      const type = inferType(title, fullText);
      const sourceUrl = window.location.href;
      
      // Generate SHA-1 ID for consistent deduplication
      // Note: source_url is stored but NOT used in ID to allow Activity + Calendar deduplication
      const id = await generateId(course, title, parsed.due_at_iso, '');
      
      const deadline: SimpleDeadline = {
        id,
        course,
        courseRaw,
        title,
        type,
        due_at_iso: parsed.due_at_iso,
        source_url: sourceUrl,
        raw_text: parsed.raw_match,
        confidence: parsed.confidence,
        source: 'Activity',
        updated: false,
        sequence: 1,
        confirmed: false,
        missing_time: parsed.missing_time
      };
      
      deadlines.push(deadline);
      console.log(`[Activity Extractor] Extracted: ${course} - ${title}`);
      
    } catch (error) {
      console.error(`[Activity Extractor] Error parsing item ${index}:`, error);
    }
  }
  
  console.log(`[Activity Extractor] Successfully extracted ${deadlines.length} deadlines`);
  return deadlines;
}

// V2 CRITICAL FIX: Wait for React to render calendar items before extraction
function waitForCalendarItems(timeout: number = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    // List of selectors to check - REAL DOM from user's HTML
    const checkSelectors = [
      '.element-card.due-item',
      '.element-card-deadline'
    ];
    
    const checkForItems = () => {
      // Try each selector
      for (const selector of checkSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`[Calendar Extractor] ✓ Items appeared after ${Date.now() - startTime}ms using selector: ${selector}`);
          resolve(true);
          return;
        }
      }
      
      // Check timeout
      if (Date.now() - startTime >= timeout) {
        console.warn(`[Calendar Extractor] ⚠️ Timeout after ${timeout}ms - no calendar items found`);
        resolve(false);
        return;
      }
      
      // Continue polling every 500ms
      setTimeout(checkForItems, 500);
    };
    
    checkForItems();
  });
}

// Parse Calendar/Deadline page - V1.5 EXACT RESTORATION
async function parseCalendarDeadlines(): Promise<SimpleDeadline[]> {
  const deadlines: SimpleDeadline[] = [];
  
  // PHASE 1 FIX: Use location.href instead of pathname for SPA navigation timing
  if (!window.location.href.includes('/ultra/deadline') && 
      !window.location.href.includes('/ultra/calendar')) {
    console.log('[Calendar Extractor] Not on calendar/deadline page');
    return deadlines;
  }
  
  console.log('[Calendar Extractor] Searching for deadline items...');
  console.log('[Calendar Extractor] Current URL:', window.location.href);
  
  // TIMING FIX: Wait for Angular to render deadline items (SPA loads async)
  console.log('[Calendar Extractor] Waiting for calendar items to load...');
  const itemsAppeared = await waitForCalendarItems(15000);
  
  if (!itemsAppeared) {
    console.warn('[Calendar Extractor] ⚠️ No deadline items appeared after waiting - page may be empty');
    return deadlines;
  }
  
  // Query DOM after items have appeared
  const detailsElements = Array.from(
    document.querySelectorAll<HTMLDivElement>('.element-card.due-item.element-card-deadline')
  );
  
  console.log(`[Calendar Extractor] Found ${detailsElements.length} deadline items`);
  
  if (detailsElements.length === 0) {
    console.log('[Calendar Extractor] No deadline items found with selector .element-card.due-item.element-card-deadline');
    return deadlines;
  }
  
  // Extract from each card using REAL DOM structure
  for (const [index, card] of detailsElements.entries()) {
    try {
      // Extract title from .element-details .name a
      const titleElement = card.querySelector<HTMLAnchorElement>('.element-details .name a');
      const title = titleElement?.textContent?.trim() || '';
      
      if (!title) {
        console.warn(`[Calendar Extractor] Item ${index}: No title found, skipping`);
        continue;
      }
      
      // Extract due date from .element-details .content span (contains "Due date: ...")
      const contentSpans = card.querySelectorAll<HTMLSpanElement>('.element-details .content span');
      let rawDueText = '';
      for (const span of contentSpans) {
        const text = span.textContent?.trim() || '';
        if (text.startsWith('Due date:')) {
          rawDueText = text.replace(/^Due date:\s*/i, '').trim();
          break;
        }
      }
      
      if (!rawDueText) {
        console.warn(`[Calendar Extractor] Item ${index}: No due date found for "${title}", skipping`);
        continue;
      }
      
      // Extract course from .element-details .content a
      const courseLink = card.querySelector<HTMLAnchorElement>('.element-details .content a');
      let courseRaw = 'Unknown Course';
      
      if (courseLink) {
        courseRaw = courseLink.textContent?.trim() || 'Unknown Course';
      }
      
      // V2 FIX: Always use common deadline page as source (avoids 404 errors from deep links)
      const sourceUrl = 'https://edimension.sutd.edu.sg/ultra/deadline';
      
      // PHASE 1: Log extracted raw data
      console.log(`[Calendar Extractor] Item ${index} RAW DATA:`, {
        title,
        rawDueText,
        courseRaw,
        sourceUrl
      });
      
      // Parse date using existing utility
      const parsed = parseDeadlineDate(rawDueText);
      if (!parsed) {
        console.warn(`[Calendar Extractor] Item ${index}: Could not parse date "${rawDueText}"`);
        continue;
      }
      
      const course = normalizeCourse(courseRaw);
      const type = inferType(title, rawDueText);
      
      // PHASE 1: Extract courseCode from eDimension course name (XX.XXX pattern)
      const courseCode = extractCourseCode(courseRaw);
      
      // Generate ID for deduplication
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
      
      // PHASE 1: Detailed logging of processed data
      console.log(`[Calendar Extractor] Item ${index} PROCESSED:`, {
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
  
  console.log(`[Calendar Extractor] ✅ PHASE 1 COMPLETE: Extracted ${deadlines.length} deadlines from Calendar page`);
  console.log('[Calendar Extractor] Full deadline array:', deadlines);
  
  return deadlines;
}

// V2: Parse Gradescope assignments (GENERALIZED for any course)
async function parseGradescopeAssignments(): Promise<SimpleDeadline[]> {
  const deadlines: SimpleDeadline[] = [];
  
  // V2 GENERALIZATION: Path guard - only run on course dashboard pages
  const pathPattern = /\/courses\/\d+\/?$/;
  if (!pathPattern.test(window.location.pathname)) {
    console.log('[Gradescope Extractor] Not on Gradescope course dashboard page');
    return deadlines;
  }
  
  console.log('[Gradescope Extractor] Searching for assignments...');
  console.log('[Gradescope Extractor] Current URL:', window.location.href);
  
  // Extract course ID from URL (e.g., /courses/1110932)
  const urlMatch = window.location.pathname.match(/\/courses\/(\d+)/);
  if (!urlMatch) {
    console.warn('[Gradescope Extractor] Could not extract course ID from URL');
    return deadlines;
  }
  
  const courseId = urlMatch[1];
  const courseUrl = `https://www.gradescope.com/courses/${courseId}`;
  
  // V2 GENERALIZATION: Extract course name from REAL DOM structure
  // Use .sidebar--subtitle as primary (contains full course name)
  // Fallback to .sidebar--title-course a (course code only)
  const subtitleElem = document.querySelector('.sidebar--subtitle');
  const headerTitleElem = document.querySelector('.courseHeader--title');
  
  // V1.1.5 FIX: Extract term year from course header for accurate date parsing
  // Primary: .courseHeader--term (e.g., "Fall 2025")
  // Fallback: .sidebar--subtitle (e.g., "2025 September Term - ...")
  const termElem = document.querySelector('.courseHeader--term');
  const termYear = extractTermYear(
    termElem?.textContent?.trim(),
    subtitleElem?.textContent?.trim()
  );
  
  if (termYear) {
    console.log(`[Gradescope Extractor] Extracted term year: ${termYear}`);
  } else {
    console.warn('[Gradescope Extractor] Could not extract term year from page, falling back to heuristic');
  }
  
  let courseName = subtitleElem?.textContent?.trim() || headerTitleElem?.textContent?.trim() || `Course ${courseId}`;
  
  // PHASE 1: Extract courseCode using helper (XX.XXX pattern)
  // Try subtitle first, then header title as fallback
  let courseCode = extractCourseCode(subtitleElem?.textContent?.trim());
  if (!courseCode) {
    courseCode = extractCourseCode(headerTitleElem?.textContent?.trim());
  }
  
  // V2 GENERALIZATION: Clean course name - remove year prefix if present
  // Example: "2025 September Term - 10.013 : Modelling and Analysis" → "10.013 : Modelling and Analysis"
  const parts = courseName.split(' - ');
  if (parts.length >= 2 && /\d{4}/.test(parts[0])) {
    // First part contains a year → treat as prefix and drop it
    courseName = parts.slice(1).join(' - ').trim();
  }
  
  // V2 GENERALIZATION: Log warning if course name extraction failed
  if (!subtitleElem && !headerTitleElem) {
    console.warn('[Gradescope Extractor] Warning: could not find course header elements (.sidebar--subtitle or .courseHeader--title)');
  }
  
  // Normalize course name for consistency with eDimension
  const course = normalizeCourse(courseName);
  console.log('[Gradescope Extractor] Course:', course, '(ID:', courseId, ', Raw:', courseName, ', Code:', courseCode, ')');
  
  // Find assignment table
  const table = document.querySelector<HTMLTableElement>('table');
  if (!table) {
    console.log('[Gradescope Extractor] No assignment table found');
    return deadlines;
  }
  
  // V2 FIX: Find "Due" column index by searching headers
  const headerRow = table.querySelector<HTMLTableRowElement>('thead tr');
  let dueColumnIndex = -1;
  
  if (headerRow) {
    const headers = Array.from(headerRow.querySelectorAll<HTMLTableCellElement>('th, td'));
    for (let i = 0; i < headers.length; i++) {
      const headerText = headers[i].textContent?.toLowerCase().trim() || '';
      // Match "Due", "Due Date", "Due (+08)" etc.
      if (headerText.includes('due') && !headerText.includes('late')) {
        dueColumnIndex = i;
        console.log(`[Gradescope Extractor] Found "Due" column at index ${i} (header: "${headers[i].textContent?.trim()}")`);
        break;
      }
    }
  }
  
  if (dueColumnIndex === -1) {
    console.warn('[Gradescope Extractor] Could not find "Due" column header, will try fallback logic');
  }
  
  // Find assignment table rows
  const tableRows = Array.from(
    table.querySelectorAll<HTMLTableRowElement>('tbody tr')
  );
  
  console.log(`[Gradescope Extractor] Found ${tableRows.length} table rows`);
  
  if (tableRows.length === 0) {
    console.log('[Gradescope Extractor] No assignment rows found');
    return deadlines;
  }
  
  const now = new Date();
  
  for (const [index, row] of tableRows.entries()) {
    try {
      // FINAL FIX: Extract assignment name from button (future) OR link (past)
      // Future: <th><button class="js-submitAssignment">HW9</button></th>
      // Past: <th><a>HW2</a></th>
      const nameElem = row.querySelector<HTMLElement>('th button.js-submitAssignment, th a');
      const title = nameElem?.textContent?.trim() || '';
      
      if (!title) {
        console.warn(`[Gradescope Extractor] Row ${index}: No assignment name found, skipping`);
        continue;
      }
      
      // V2 FIX: Extract due date from "Due" column using header-based index
      const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td'));
      
      let dueCell: HTMLTableCellElement | null = null;
      
      if (dueColumnIndex >= 0 && dueColumnIndex < cells.length) {
        // Use header-based column index
        dueCell = cells[dueColumnIndex];
      } else {
        // CRITICAL FIX: Fallback with "due" keyword validation
        for (const cell of cells) {
          const text = cell.textContent?.trim().toLowerCase() || '';
          // Look for Gradescope date patterns AND verify no "release" keywords
          if (text.match(/\w{3}\s+\d{1,2}\s+at\s+\d{1,2}:\d{2}/i)) {
            // Exclude "Released" column - verify this looks like a due date
            const isReleasedColumn = text.includes('release') || cell.previousElementSibling?.textContent?.toLowerCase().includes('release');
            
            if (!isReleasedColumn) {
              dueCell = cell;
              console.log(`[Gradescope Extractor] Row ${index}: Found due date by pattern in cell: "${text}"`);
              break;
            } else {
              console.log(`[Gradescope Extractor] Row ${index}: Skipping Released column, continuing search...`);
            }
          }
        }
      }
      
      if (!dueCell) {
        console.warn(`[Gradescope Extractor] Row ${index}: No due date cell found for "${title}", skipping`);
        continue;
      }
      
      // FINAL FIX: Extract due date from REAL Gradescope DOM structure
      // Real classes from actual HTML:
      // - time.submissionTimeChart--dueDate (main due date)
      // - time.submissionTimeChart--lateDueDate (late submission due date)
      
      let rawDueText = '';
      let lateDueDate = '';
      
      // Primary: Look for the actual due date <time> element
      const dueTimeElem = row.querySelector<HTMLTimeElement>('time.submissionTimeChart--dueDate');
      if (dueTimeElem) {
        rawDueText = dueTimeElem.textContent?.trim() || '';
        console.log(`[Gradescope Extractor] Row ${index}: Found due date: "${rawDueText}"`);
      }
      
      // Check for late due date
      const lateDueTimeElem = row.querySelector<HTMLTimeElement>('time.submissionTimeChart--lateDueDate');
      if (lateDueTimeElem) {
        lateDueDate = lateDueTimeElem.textContent?.trim() || '';
        console.log(`[Gradescope Extractor] Row ${index}: Found late due date: "${lateDueDate}"`);
      }
      
      if (!rawDueText) {
        console.warn(`[Gradescope Extractor] Row ${index}: No time.submissionTimeChart--dueDate found for "${title}", skipping`);
        continue;
      }
      
      console.log(`[Gradescope Extractor] Row ${index} RAW DATA:`, {
        title,
        rawDueText,
        lateDueDate,
        course,
        termYear
      });
      
      // Parse date with term year context (V1.1.5 FIX)
      const parsed = parseDeadlineDate(rawDueText, termYear || undefined);
      if (!parsed) {
        console.warn(`[Gradescope Extractor] Row ${index}: Could not parse date "${rawDueText}"`);
        continue;
      }
      
      // V2: Filter out past deadlines (only include future deadlines)
      const dueDate = new Date(parsed.due_at_iso);
      if (dueDate < now) {
        console.log(`[Gradescope Extractor] Row ${index}: Skipping past deadline "${title}" (due: ${parsed.due_at_iso})`);
        continue;
      }
      
      const type = inferType(title, rawDueText);
      
      // Add late due date info to raw_text if present
      let fullRawText = parsed.raw_match;
      if (lateDueDate) {
        fullRawText += `\nLate submissions accepted until: ${lateDueDate}`;
      }
      
      // Generate ID for deduplication
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
      
      console.log(`[Gradescope Extractor] Row ${index} PROCESSED:`, {
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
  
  console.log(`[Gradescope Extractor] ✅ Extracted ${deadlines.length} future deadlines from Gradescope`);
  console.log('[Gradescope Extractor] Full deadline array:', deadlines);
  
  return deadlines;
}

// V2: Save deadlines to storage with multi-source merge and deduplication
async function saveToStorage(deadlines: SimpleDeadline[]) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.get(['deadlines'], (result) => {
      const existing = result.deadlines || [];
      
      // Determine source of new deadlines (all should have same source in a single extraction)
      const newSource = deadlines.length > 0 ? deadlines[0].source : null;
      
      // V2: Keep all non-Activity items (Calendar, Gradescope, Manual, etc.)
      const existingNonActivity = existing.filter((d: SimpleDeadline) => d.source !== 'Activity');
      
      // V2: Build legacy map for migration (Activity → Calendar/Gradescope)
      const legacyMap = new Map(existing.map((d: SimpleDeadline) => [d.id, d]));
      
      // V2 MULTI-COURSE FIX: Extract courseId from Gradescope source_url for proper scoping
      // Format: https://www.gradescope.com/courses/1110932
      let newCourseId: string | null = null;
      if (newSource === 'Gradescope' && deadlines.length > 0) {
        const urlMatch = deadlines[0].source_url.match(/\/courses\/(\d+)/);
        if (urlMatch) {
          newCourseId = urlMatch[1];
          console.log(`[DC Storage] Gradescope extraction from course ${newCourseId}`);
        }
      }
      
      // V2: Distinguish snapshot sources (full replacement) vs incremental sources (merge by ID)
      // - Snapshot sources: Calendar, Gradescope (bulk extraction provides complete view PER COURSE)
      // - Incremental sources: Manual, Assignment, Announcement (popup adds one-at-a-time)
      const snapshotSources = ['Calendar', 'Gradescope'];
      const isSnapshot = newSource && snapshotSources.includes(newSource);
      
      let baseItems: SimpleDeadline[];
      if (isSnapshot) {
        // V2 MULTI-COURSE FIX: Snapshot mode with course scoping
        // Keep items from OTHER sources AND other Gradescope courses
        // Only replace items from CURRENT (source, courseId) combination
        baseItems = existingNonActivity.filter((d: SimpleDeadline) => {
          if (d.source !== newSource) {
            // Keep all items from different sources
            return true;
          }
          
          if (newSource === 'Gradescope' && newCourseId) {
            // For Gradescope: only remove items from the SAME course
            const existingCourseId = d.source_url.match(/\/courses\/(\d+)/)?.[1];
            return existingCourseId !== newCourseId;
          }
          
          // For other snapshot sources (Calendar): remove all items from same source
          return false;
        });
      } else {
        // Incremental mode: keep all existing items, merge by ID
        baseItems = existingNonActivity;
      }
      
      // Start with base items
      const mergedMap = new Map(baseItems.map((d: SimpleDeadline) => [d.id, d]));
      
      // Add/update items from current extraction, preserving confirmations
      deadlines.forEach(newItem => {
        // Check if this item existed before (same ID, possibly different source due to migration)
        const legacyItem = legacyMap.get(newItem.id) as SimpleDeadline | undefined;
        
        if (legacyItem) {
          // Preserve user confirmations and sequence from any previous source
          newItem.confirmed = legacyItem.confirmed || newItem.confirmed;
          newItem.sequence = legacyItem.sequence;
          
          // Check if due date changed (for update tracking)
          if (legacyItem.due_at_iso !== newItem.due_at_iso) {
            newItem.updated = true;
            newItem.sequence = (legacyItem.sequence || 1) + 1;
          }
          
          // Log migrations
          if (legacyItem.source === 'Activity' && newItem.source !== 'Activity') {
            console.log(`[DC] Migrating Activity→${newItem.source}: "${newItem.title}" (confirmed=${newItem.confirmed})`);
          }
        }
        
        mergedMap.set(newItem.id, newItem);
      });
      
      const merged: SimpleDeadline[] = Array.from(mergedMap.values()) as SimpleDeadline[];
      
      const removedCount = existing.length - existingNonActivity.length;
      if (removedCount > 0) {
        console.log(`[DC] Storage migration: Removed ${removedCount} old Activity entries (confirmations preserved)`);
      }
      
      // Count by source for logging
      const sourceCounts: Record<string, number> = {};
      merged.forEach(d => {
        sourceCounts[d.source] = (sourceCounts[d.source] || 0) + 1;
      });
      
      console.log(`[DC] ✅ Saved ${merged.length} total deadlines:`, sourceCounts);
      
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

// Main extraction function
async function extractAndSave() {
  console.log('[DC] Starting extraction...');
  const startTime = performance.now();
  const url = window.location.href;
  
  try {
    let deadlines: SimpleDeadline[] = [];
    
    // V2: Route to appropriate parser based on URL
    if (url.includes('edimension.sutd.edu.sg')) {
      // V1.5: eDimension Calendar-only extraction (Activity Stream disabled)
      deadlines = await parseCalendarDeadlines();
    } else if (url.includes('gradescope.com/courses/')) {
      // V2: Gradescope assignments extraction
      deadlines = await parseGradescopeAssignments();
    } else {
      console.log('[DC] Not on a supported page (eDimension or Gradescope)');
      return;
    }
    
    if (deadlines.length > 0) {
      await saveToStorage(deadlines);
      const duration = Math.round(performance.now() - startTime);
      console.log(`[DC] ✅ Extraction complete in ${duration}ms`);
    } else {
      console.log('[DC] No deadlines found on this page');
    }
  } catch (error) {
    console.error('[DC] Extraction failed:', error);
  }
}

// Run extraction on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(extractAndSave, 1000);
  });
} else {
  setTimeout(extractAndSave, 1000);
}

// Watch for URL changes (for SPA navigation)
let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    console.log('[DC] URL changed, re-extracting...');
    lastUrl = window.location.href;
    setTimeout(extractAndSave, 1000);
  }
}, 1000);
