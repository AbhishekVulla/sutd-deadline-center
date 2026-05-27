import React, { useState } from 'react';
import { DeadlineItem, Settings } from '../../types';
import { getDeadlines, saveDeadlines } from '../../storage';
import { generateId } from '../../parsing/hash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const NEW_COURSE_SENTINEL = '__NEW_COURSE__';

interface Props {
  item: DeadlineItem;
  onClose: () => void;
  onSave: () => void;
  settings: Settings;
  existingCourses: string[];
}

function EditModal({ item, onClose, onSave, settings, existingCourses }: Props) {
  const isNewItem = !item.id;
  const dueDate = isNewItem ? dayjs() : dayjs(item.due_at_iso);

  const [title, setTitle] = useState(item.title || '');
  const [course, setCourse] = useState(item.course || '');
  const [newCourseMode, setNewCourseMode] = useState(false);
  const [date, setDate] = useState(dueDate.format('YYYY-MM-DD'));
  const [time, setTime] = useState(isNewItem ? '23:59' : dueDate.format('HH:mm'));

  function handleCourseSelectChange(value: string) {
    if (value === NEW_COURSE_SENTINEL) {
      setNewCourseMode(true);
      setCourse('');
    } else {
      setCourse(value);
    }
  }

  async function handleSave() {
    if (!title.trim() || !course.trim()) {
      alert('Please fill in both title and course');
      return;
    }

    try {
      const newDueAt = dayjs.tz(`${date} ${time}`, settings.timezone).toISOString();
      const deadlines = await getDeadlines();

      if (isNewItem) {
        const id = await generateId(course, title, newDueAt, 'manual');
        const newDeadline: DeadlineItem = {
          id,
          course,
          title,
          type: 'Other',
          due_at_iso: newDueAt,
          source_url: '',
          raw_text: `Manually added: ${date} ${time}`,
          confidence: 1.0,
          source: 'Manual',
          updated: false,
          sequence: 1,
          confirmed: true,
          missing_time: false
        };
        await saveDeadlines([...deadlines, newDeadline]);
      } else {
        const updatedDeadlines = deadlines.map(d => {
          if (d.id === item.id) {
            return {
              ...d,
              title,
              course,
              due_at_iso: newDueAt,
              missing_time: false
            };
          }
          return d;
        });
        await saveDeadlines(updatedDeadlines);
      }

      onSave();
    } catch (error) {
      console.error('Failed to save deadline:', error);
      alert('Failed to save changes. Please try again.');
    }
  }

  const showCourseTextInput = !isNewItem || newCourseMode;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{isNewItem ? 'Add Deadline' : 'Edit Deadline'}</h2>

        <div className="form-group">
          <label>Course:</label>
          {showCourseTextInput ? (
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="form-input"
              placeholder="e.g., 10.015 – Physical World"
              disabled={!isNewItem}
              autoFocus={isNewItem && newCourseMode}
            />
          ) : (
            <select
              value={course}
              onChange={(e) => handleCourseSelectChange(e.target.value)}
              className="form-select"
            >
              <option value="">Select a course…</option>
              {existingCourses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={NEW_COURSE_SENTINEL}>+ New course</option>
            </select>
          )}
        </div>

        <div className="form-group">
          <label>Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
            placeholder="e.g., Problem Set 3"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Date:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Time:</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {!isNewItem && (
          <div className="form-info">
            <span><strong>Source:</strong> {item.source}</span>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-cancel">
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            {isNewItem ? 'Add Deadline' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditModal;
