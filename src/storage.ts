import { DeadlineItem, Settings, StorageData } from './types';

const DEFAULT_SETTINGS: Settings = {
  timezone: 'Asia/Singapore',
  reminders: {
    hours_48: true,
    hours_24: true,
    hours_2: true
  },
  auto_confirm_threshold: 0
};

export async function getDeadlines(): Promise<DeadlineItem[]> {
  const result = await chrome.storage.local.get('deadlines');
  return result.deadlines || [];
}

export async function saveDeadlines(deadlines: DeadlineItem[]): Promise<void> {
  await chrome.storage.local.set({ deadlines });
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return result.settings || DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}

export function detectUpdates(
  oldDeadlines: DeadlineItem[],
  newDeadlines: DeadlineItem[]
): DeadlineItem[] {
  const oldMap = new Map(oldDeadlines.map(d => [d.id, d]));
  
  return newDeadlines.map(newItem => {
    const oldItem = oldMap.get(newItem.id);
    
    if (!oldItem) {
      return { ...newItem, updated: false, sequence: 1 };
    }
    
    if (oldItem.due_at_iso !== newItem.due_at_iso) {
      return {
        ...newItem,
        updated: true,
        sequence: (oldItem.sequence || 1) + 1,
        confirmed: oldItem.confirmed
      };
    }
    
    return {
      ...newItem,
      updated: oldItem.updated,
      sequence: oldItem.sequence || 1,
      confirmed: oldItem.confirmed
    };
  });
}

export function deduplicateDeadlines(deadlines: DeadlineItem[]): DeadlineItem[] {
  const seen = new Map<string, DeadlineItem>();
  
  for (const deadline of deadlines) {
    const key = `${deadline.course}|${deadline.title.toLowerCase().replace(/[^\w\s]/g, '')}`;
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, deadline);
      continue;
    }
    
    const timeDiff = Math.abs(
      new Date(deadline.due_at_iso).getTime() - new Date(existing.due_at_iso).getTime()
    );
    
    if (timeDiff <= 60 * 60 * 1000) {
      if (deadline.confidence > existing.confidence) {
        seen.set(key, deadline);
      }
    } else {
      const newKey = `${key}|${deadline.due_at_iso}`;
      seen.set(newKey, deadline);
    }
  }
  
  return Array.from(seen.values());
}
