import React, { useState, useEffect } from 'react';
import { DeadlineItem, Settings } from '../types';
import { getDeadlines, getSettings } from '../storage';
import ItemCard from './components/ItemCard';
import Filters from './components/Filters';
import EditModal from './components/EditModal';
import './styles.css';

type TimeGroup = 'thisWeek' | 'nextWeek' | 'later' | 'overdue';

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

function App() {
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingItem, setEditingItem] = useState<DeadlineItem | null>(null);
  const [loading, setLoading] = useState(true);

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

  // PHASE 1: Build course grouping map (courseCode-based deduplication)
  // Map: courseKey -> raw name
  // For items with courseCode: key = courseCode, value = longest course name with that code
  // For items without courseCode: key = course name, value = course name
  const courseKeyToName = new Map<string, string>();
  const courseNameToKey = new Map<string, string>();
  const courseKeyToCode = new Map<string, string | null>();
  
  for (const d of deadlines) {
    if (d.courseCode) {
      // Has courseCode - use it as the grouping key
      const existing = courseKeyToName.get(d.courseCode);
      // Prefer longer course names (eDimension "10.015 – Physical World" over Gradescope "Physical World (2025)")
      if (!existing || d.course.length > existing.length) {
        courseKeyToName.set(d.courseCode, d.course);
        courseKeyToCode.set(d.courseCode, d.courseCode);
      }
      courseNameToKey.set(d.course, d.courseCode);
    } else {
      // No courseCode - use course name as key
      courseKeyToName.set(d.course, d.course);
      courseNameToKey.set(d.course, d.course);
      courseKeyToCode.set(d.course, null);
    }
  }
  
  // PHASE 2: Build display course list with cleaned names
  const courses = Array.from(new Set(courseKeyToName.values())).sort();
  const courseDisplayNames = new Map<string, string>();
  for (const rawName of courses) {
    const key = courseNameToKey.get(rawName);
    const code = key ? courseKeyToCode.get(key) : null;
    courseDisplayNames.set(rawName, getDisplayCourseName(rawName, code));
  }
  
  const filteredDeadlines = deadlines.filter(item => {
    if (selectedCourse !== 'all') {
      // PHASE 1: Match by courseCode if both have it, otherwise by course name
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

  const groupedDeadlines = groupByTime(filteredDeadlines);

  function handleRefresh() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_NOW' });
        setTimeout(loadData, 1000);
      }
    });
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
          <button onClick={handleRefresh} className="refresh-btn" title="Refresh from eDimension">
            ↻ Refresh
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
              <h2 className="group-title">{formatGroupTitle(group as TimeGroup)}</h2>
              {items.map(item => {
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

        {filteredDeadlines.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No deadlines yet</h3>
            <p>To get started:</p>
            <ol className="empty-instructions">
              <li>
                Visit <a href="https://edimension.sutd.edu.sg/ultra/deadline" target="_blank" rel="noopener noreferrer">
                  eDimension Calendar
                </a>
              </li>
              <li>
                Open each course from your{' '}
                <a href="https://www.gradescope.com/" target="_blank" rel="noopener noreferrer">
                  Gradescope dashboard
                </a>
              </li>
              <li>Click <strong>Refresh</strong> in this popup</li>
              <li>Export deadlines to your calendar</li>
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
