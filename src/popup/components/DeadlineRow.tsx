import React from 'react';
import { DeadlineItem, Settings } from '../../types';
import { downloadICS } from '../../calendar';

interface Props {
  item: DeadlineItem;
  displayCourseName: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  isOverdue: boolean;
  settings: Settings;
}

function formatCompactDate(isoString: string): string {
  const due = new Date(isoString);
  const now = new Date();
  const isSameYear = due.getFullYear() === now.getFullYear();

  const time = due.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  };
  if (!isSameYear) {
    options.year = 'numeric';
  }

  return `${due.toLocaleDateString('en-SG', options)} ${time}`;
}

function formatCountdown(isoString: string): string {
  const due = new Date(isoString);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();

  if (diffMs < 0) {
    return 'Overdue';
  }

  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  const isToday = due.toDateString() === now.toDateString();
  if (isToday) {
    return 'Today';
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (due.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    return `${hours} hour${hours !== 1 ? 's' : ''} left`;
  }

  if (diffDays < 7) {
    const days = Math.floor(diffDays);
    return `${days} day${days !== 1 ? 's' : ''} left`;
  }

  if (diffDays < 14) {
    return '1 week left';
  }

  const weeks = Math.floor(diffDays / 7);
  return `${weeks} weeks left`;
}

function DeadlineRow({
  item,
  displayCourseName,
  isExpanded,
  onToggleExpand,
  onEdit,
  isOverdue,
  settings,
}: Props) {
  const dateStr = formatCompactDate(item.due_at_iso);
  const countdown = formatCountdown(item.due_at_iso);

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    downloadICS(item, settings);
  }

  function handleOpenSource(e: React.MouseEvent) {
    e.stopPropagation();
    chrome.tabs.create({ url: item.source_url });
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit();
  }

  return (
    <div
      className={`deadline-row ${isExpanded ? 'expanded' : ''}`}
      onClick={onToggleExpand}
    >
      {/* Line 1: Course + Countdown */}
      <div className="row-line-1">
        <span className="row-course">{displayCourseName}</span>
        <span className="row-countdown">{countdown}</span>
      </div>

      {/* Line 2: Title + Date */}
      <div className="row-line-2">
        <span className="row-title" title={item.title}>{item.title}</span>
        <span className="row-separator">&middot;</span>
        <span className="row-date">{dateStr}</span>
      </div>

      {/* Expandable action bar */}
      <div className="row-actions-wrapper">
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          {item.source_url && item.source !== 'Manual' && (
            <button onClick={handleOpenSource} className="row-action-btn" title="View source">
              Source
            </button>
          )}
          <button onClick={handleDownload} className="row-action-btn" title="Download .ics">
            Download .ics
          </button>
          <button onClick={handleEdit} className="row-action-btn" title="Edit">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeadlineRow;
