import React, { useState } from 'react';
import { DeadlineItem, DeadlineType, Settings } from '../../types';
import { getDeadlines, saveDeadlines } from '../../storage';
import { generateId } from '../../parsing/hash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface Props {
  item: DeadlineItem;
  onClose: () => void;
  onSave: () => void;
  settings: Settings;
}

function EditModal({ item, onClose, onSave, settings }: Props) {
  const isNewItem = !item.id;
  const dueDate = isNewItem ? dayjs() : dayjs(item.due_at_iso);
  
  const [title, setTitle] = useState(item.title || '');
  const [course, setCourse] = useState(item.course || '');
  const [type, setType] = useState<DeadlineType>(item.type || 'HW');
  const [date, setDate] = useState(dueDate.format('YYYY-MM-DD'));
  const [time, setTime] = useState(isNewItem ? '23:59' : dueDate.format('HH:mm'));

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
          type,
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
              type,
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{isNewItem ? 'Add Deadline' : 'Edit Deadline'}</h2>
        
        <div className="form-group">
          <label>Course:</label>
          <input
            type="text"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="form-input"
            placeholder="e.g., 10.015 : Physical World"
            disabled={!isNewItem}
          />
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

        <div className="form-group">
          <label>Type:</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DeadlineType)}
            className="form-select"
          >
            <option value="HW">Homework</option>
            <option value="Quiz">Quiz</option>
            <option value="Project">Project</option>
            <option value="Exam">Exam</option>
            <option value="Other">Other</option>
          </select>
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
            <p><strong>Source:</strong> {item.source}</p>
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
