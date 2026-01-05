import React, { useState, useEffect, useMemo } from 'react';
import { DeadlineItem, Settings } from '../types';
import { getDeadlines, getSettings } from '../storage';
import { downloadMergedICS } from '../calendar';
import ItemCard from './components/ItemCard';
import Filters from './components/Filters';
import EditModal from './components/EditModal';
import './styles.css';

type TimeGroup = 'thisWeek' | 'nextWeek' | 'later' | 'overdue';

const OVERDUE_EXPIRY_DAYS = 3;

// PHASE 2: Display-only course name cleaner (does NOT affect grouping/dedup logic)
function getDisplayCourseName(rawName: string, courseCode?: string | null): string {
  let name = rawName.trim();
  
  // If courseCode exists and appears in the raw name, use it as anchor point
  // This strips "2530-XXXXXX-" prefixes automatically
  if (courseCode && name.includes(courseCode)) {
    const idx = name.indexOf(courseCode);
    if (idx >= 0) {
      name = name.slice(idx).trim();
    }
  } else {
    // For courses without XX.XXX code (e.g., EWET), drop everything before the last "–"
    const lastDashIdx = name.lastIndexOf('–');
    if (lastDashIdx !== -1) {
      name = name.slice(lastDashIdx + 1).trim();
    }
  }
  
  return name;
}

/**
 * SINGLE SOURCE OF TRUTH: Determines if a deadline is "visible"
 * A deadline is visible if:
 * 1. It's not overdue, OR
 * 2. It's overdue but within the OVERDUE_EXPIRY_DAYS threshold
 */
function isDeadlineVisible(deadline: DeadlineItem): boolean {
  const now = new Date();
  const dueDate = new Date(deadline.due_at_iso);
  
  if (dueDate >= now) {
    return true;
  }
  
  const overdueThreshold = new Date(now);
  overdueThreshold.setDate(now.getDate() - OVERDUE_EXPIRY_DAYS);
  return dueDate >= overdueThreshold;
}

function App() {
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingItem, setEditingItem] = useState<DeadlineItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [overdueExpanded, setOverdueExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [deadlinesData, settingsData] = await Promise.all([
        getDeadlines(),
        getSettings()
      ]);
      setDeadlines(deadlinesData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  // STEP 1: Filter to only VISIBLE deadlines (applies overdue threshold)
  // This is the canonical list - all other filtering builds on top of this
  const baseVisibleDeadlines = useMemo(() => 
    deadlines.filter(isDeadlineVisible), 
    [deadlines]
  );

  // STEP 2: Build course grouping map from VISIBLE deadlines only
  // This ensures courses with only expired overdue items don't appear in dropdown
  const { courseKeyToName, courseNameToKey, courseKeyToCode } = useMemo(() => {
    const keyToName = new Map<string, string>();
    const nameToKey = new Map<string, string>();
    const keyToCode = new Map<string, string | null>();
    
    for (const d of baseVisibleDeadlines) {
      if (d.courseCode) {
        const existing = keyToName.get(d.courseCode);
        if (!existing || d.course.length > existing.length) {
          keyToName.set(d.courseCode, d.course);
          keyToCode.set(d.courseCode, d.courseCode);
        }
        nameToKey.set(d.course, d.courseCode);
      } else {
        keyToName.set(d.course, d.course);
        nameToKey.set(d.course, d.course);
        keyToCode.set(d.course, null);
      }
    }
    
    return { courseKeyToName: keyToName, courseNameToKey: nameToKey, courseKeyToCode: keyToCode };
  }, [baseVisibleDeadlines]);
  
  // STEP 3: Build display course list with cleaned names
  const courses = useMemo(() => 
    Array.from(new Set(courseKeyToName.values())).sort(),
    [courseKeyToName]
  );
  
  const courseDisplayNames = useMemo(() => {
    const displayNames = new Map<string, string>();
    for (const rawName of courses) {
      const key = courseNameToKey.get(rawName);
      const code = key ? courseKeyToCode.get(key) : null;
      displayNames.set(rawName, getDisplayCourseName(rawName, code));
    }
    return displayNames;
  }, [courses, courseNameToKey, courseKeyToCode]);
  
  // STEP 4: Apply user filters (course + search) to visible deadlines
  // This is the FINAL list used for export count, export contents, and UI
  const visibleDeadlines = useMemo(() => {
    return baseVisibleDeadlines.filter(item => {
      if (selectedCourse !== 'all') {
        const selectedKey = courseNameToKey.get(selectedCourse);
        const itemKey = item.courseCode || item.course;
        
        if (selectedKey !== itemKey && item.course !== selectedCourse) {
          return false;
        }
      }
      if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [baseVisibleDeadlines, selectedCourse, searchQuery, courseNameToKey]);

  // STEP 5: Group visible deadlines by time for UI rendering
  const groupedDeadlines = useMemo(() => 
    groupByTime(visibleDeadlines),
    [visibleDeadlines]
  );

  function handleExportVisible() {
    if (!settings) return;
    downloadMergedICS(visibleDeadlines, settings);
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading deadlines...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Deadline Center</h1>
        <div className="header-actions">
          <button onClick={() => setEditingItem({} as DeadlineItem)} className="add-btn" title="Add deadline manually">
            + Add Deadline
          </button>
          <button onClick={handleExportVisible} className="export-btn" title="Export all visible deadlines to calendar" disabled={visibleDeadlines.length === 0}>
            📅 Export Visible ({visibleDeadlines.length})
          </button>
        </div>
      </header>

      <Filters
        courses={courses}
        courseDisplayNames={courseDisplayNames}
        selectedCourse={selectedCourse}
        onCourseChange={setSelectedCourse}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="deadline-list">
        {Object.entries(groupedDeadlines).map(([group, items]) => (
          items.length > 0 && (
            <div key={group} className="time-group">
              {group === 'overdue' ? (
                <h2 
                  className="group-title group-title-collapsible" 
                  onClick={() => setOverdueExpanded(!overdueExpanded)}
                >
                  <span className={`collapse-chevron ${overdueExpanded ? 'expanded' : ''}`}>▶</span>
                  {formatGroupTitle(group as TimeGroup)} ({items.length})
                </h2>
              ) : (
                <h2 className="group-title">{formatGroupTitle(group as TimeGroup)}</h2>
              )}
              {(group !== 'overdue' || overdueExpanded) && items.map(item => {
                const displayName = getDisplayCourseName(item.course, item.courseCode);
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    displayCourseName={displayName}
                    onEdit={() => setEditingItem(item)}
                    settings={settings!}
                  />
                );
              })}
            </div>
          )
        ))}

        {visibleDeadlines.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No deadlines yet</h3>
            <p>To get started:</p>
            <ol className="empty-instructions">
              <li>
                Visit <a href="https://edimension.sutd.edu.sg/ultra/deadline" target="_blank" rel="noopener noreferrer">
                  eDimension Calendar
                </a> — deadlines are extracted automatically
              </li>
              <li>
                Open each course from your{' '}
                <a href="https://www.gradescope.com/" target="_blank" rel="noopener noreferrer">
                  Gradescope dashboard
                </a>
              </li>
              <li>Come back here to export deadlines to your calendar</li>
            </ol>
          </div>
        )}
      </div>

      {editingItem && (
        <EditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={() => {
            setEditingItem(null);
            loadData();
          }}
          settings={settings!}
        />
      )}
    </div>
  );
}

function groupByTime(deadlines: DeadlineItem[]): Record<TimeGroup, DeadlineItem[]> {
  const now = new Date();
  const thisWeekEnd = new Date(now);
  thisWeekEnd.setDate(now.getDate() + 7);
  const nextWeekEnd = new Date(now);
  nextWeekEnd.setDate(now.getDate() + 14);

  const groups: Record<TimeGroup, DeadlineItem[]> = {
    overdue: [],
    thisWeek: [],
    nextWeek: [],
    later: []
  };

  // NOTE: Input deadlines are already filtered by isDeadlineVisible()
  // so we don't need to re-filter overdue items here
  for (const deadline of deadlines) {
    const dueDate = new Date(deadline.due_at_iso);

    if (dueDate < now) {
      groups.overdue.push(deadline);
    } else if (dueDate <= thisWeekEnd) {
      groups.thisWeek.push(deadline);
    } else if (dueDate <= nextWeekEnd) {
      groups.nextWeek.push(deadline);
    } else {
      groups.later.push(deadline);
    }
  }

  for (const key of Object.keys(groups) as TimeGroup[]) {
    groups[key].sort((a, b) => 
      new Date(a.due_at_iso).getTime() - new Date(b.due_at_iso).getTime()
    );
  }

  return groups;
}

function formatGroupTitle(group: TimeGroup): string {
  const titles = {
    overdue: 'Overdue',
    thisWeek: 'This Week',
    nextWeek: 'Next Week',
    later: 'Later'
  };
  return titles[group];
}

export default App;
