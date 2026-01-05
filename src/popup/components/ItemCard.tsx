import React from 'react';
import { DeadlineItem, Settings } from '../../types';
import { downloadICS } from '../../calendar';

interface Props {
  item: DeadlineItem;
  displayCourseName: string;
  onEdit: () => void;
  settings: Settings;
}

function ItemCard({ item, displayCourseName, onEdit, settings }: Props) {
  const dueDate = new Date(item.due_at_iso);
  const formattedDate = dueDate.toLocaleDateString('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const formattedTime = dueDate.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    downloadICS(item, settings);
  }

  function handleOpenSource(e: React.MouseEvent) {
    e.stopPropagation();
    chrome.tabs.create({ url: item.source_url });
  }

  return (
    <div className="item-card" onClick={onEdit}>
      <div className="item-header">
        <span className="course-badge">{displayCourseName}</span>
        <span className="type-badge">{item.type}</span>
      </div>

      <h3 className="item-title">{item.title}</h3>

      <div className="item-meta">
        <span className="due-date">
          {formattedDate} {formattedTime}
        </span>
      </div>

      <div className="item-chips">
        {item.updated && <span className="chip chip-updated">Updated</span>}
        {item.missing_time && <span className="chip chip-warning">Missing time</span>}
      </div>
      <div className="item-actions" onClick={(e) => e.stopPropagation()}>
        {item.source_url && item.source !== 'Manual' && (
          <button onClick={handleOpenSource} className="btn-link" title="View source">
            🔗 Source
          </button>
        )}
        <button onClick={handleDownload} className="btn-download" title="Download .ics">
          📅 Download .ics
        </button>
      </div>
    </div>
  );
}

export default ItemCard;
