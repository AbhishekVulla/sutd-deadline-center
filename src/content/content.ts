import { extractFromActivity } from './extractors/activity';
import { extractFromAssignments } from './extractors/assignments';
import { extractFromAnnouncements } from './extractors/announcements';
import { getDeadlines, saveDeadlines, detectUpdates, deduplicateDeadlines } from '../storage';

console.log('[DC] Content script injected into:', window.location.href, 'Frame:', window === window.top ? 'top' : 'iframe');

let extractionTimeout: number | null = null;
const DEBOUNCE_MS = 500;

async function extractDeadlines() {
  console.log('[Deadline Center] Starting extraction...');
  const startTime = performance.now();
  
  try {
    const [activityItems, assignmentItems, announcementItems] = await Promise.all([
      extractFromActivity(),
      extractFromAssignments(),
      extractFromAnnouncements()
    ]);
    
    const allItems = [
      ...activityItems,
      ...assignmentItems,
      ...announcementItems
    ];
    
    console.log(`[Deadline Center] Extracted ${allItems.length} raw items`);
    
    const deduplicated = deduplicateDeadlines(allItems);
    console.log(`[Deadline Center] After deduplication: ${deduplicated.length} items`);
    
    const existingDeadlines = await getDeadlines();
    const updatedDeadlines = detectUpdates(existingDeadlines, deduplicated);
    
    await saveDeadlines(updatedDeadlines);
    
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[Deadline Center] Extraction complete in ${duration}s`);
    
    chrome.runtime.sendMessage({
      type: 'EXTRACTION_COMPLETE',
      count: updatedDeadlines.length,
      duration
    });
  } catch (error) {
    console.error('[Deadline Center] Extraction failed:', error);
  }
}

function debouncedExtraction() {
  if (extractionTimeout) {
    clearTimeout(extractionTimeout);
  }
  extractionTimeout = window.setTimeout(() => {
    extractDeadlines();
  }, DEBOUNCE_MS);
}

function setupSPAHooks() {
  const observer = new MutationObserver((mutations) => {
    const hasRelevantChanges = mutations.some(mutation => {
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);
        return addedNodes.some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            return element.matches('li.stream-item-container, .calendar-entry, .stream-item, .element-card') ||
                   element.querySelector('li.stream-item-container, .calendar-entry');
          }
          return false;
        });
      }
      return false;
    });
    
    if (hasRelevantChanges) {
      console.log('[Deadline Center] DOM changes detected, scheduling re-extraction');
      debouncedExtraction();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    console.log('[Deadline Center] SPA navigation detected (pushState):', window.location.pathname);
    debouncedExtraction();
  };
  
  const originalReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    console.log('[Deadline Center] SPA navigation detected (replaceState):', window.location.pathname);
    debouncedExtraction();
  };
  
  window.addEventListener('popstate', () => {
    console.log('[Deadline Center] SPA navigation detected (popstate):', window.location.pathname);
    debouncedExtraction();
  });
  
  console.log('[Deadline Center] SPA hooks installed');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    extractDeadlines();
    setupSPAHooks();
  });
} else {
  extractDeadlines();
  setupSPAHooks();
}
