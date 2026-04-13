import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Settings } from '../types';
import { getSettings, saveSettings, clearAllData } from '../storage';
import './options.css';

function OptionsPage() {
  const [settings, setSettings] = useState<Settings>({
    timezone: 'Asia/Singapore',
    reminders: {
      hours_48: true,
      hours_24: true,
      hours_2: true
    },
    auto_confirm_threshold: 0
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const data = await getSettings();
    setSettings(data);
  }

  async function handleSave() {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClearData() {
    if (confirm('Are you sure you want to delete all stored deadlines? This cannot be undone.')) {
      await clearAllData();
      alert('All data has been cleared.');
    }
  }

  return (
    <div className="options-page">
      <h1>Deadline Center Settings</h1>

      <div className="section">
        <h2>Timezone</h2>
        <p className="description">Choose your timezone for date normalization.</p>
        <select
          value={settings.timezone}
          onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
          className="timezone-select"
        >
          <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
          <option value="Asia/Hong_Kong">Asia/Hong Kong (UTC+8)</option>
          <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
          <option value="America/New_York">America/New York (EST)</option>
          <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
          <option value="Europe/London">Europe/London (GMT)</option>
        </select>
      </div>

      <div className="section">
        <h2>Calendar Reminders</h2>
        <p className="description">Select which reminders to include in .ics files.</p>
        
        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={settings.reminders.hours_48}
            onChange={(e) => setSettings({
              ...settings,
              reminders: { ...settings.reminders, hours_48: e.target.checked }
            })}
          />
          <span>48 hours before</span>
        </label>

        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={settings.reminders.hours_24}
            onChange={(e) => setSettings({
              ...settings,
              reminders: { ...settings.reminders, hours_24: e.target.checked }
            })}
          />
          <span>24 hours before</span>
        </label>

        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={settings.reminders.hours_2}
            onChange={(e) => setSettings({
              ...settings,
              reminders: { ...settings.reminders, hours_2: e.target.checked }
            })}
          />
          <span>2 hours before</span>
        </label>
      </div>

      <div className="section">
        <h2>Data Management</h2>
        <p className="description">Clear all stored deadlines and reset the extension.</p>
        <button onClick={handleClearData} className="btn-danger">
          Clear All Data
        </button>
      </div>

      <div className="actions">
        <button onClick={handleSave} className="btn-save">
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>

      <div className="footer">
        <p><strong>Privacy Note:</strong> All data is stored locally in your browser. No information is sent to external servers.</p>
        <p className="attribution">Built by <a href="https://github.com/AbhishekVulla/sutd-deadline-center" target="_blank" rel="noopener noreferrer">Abhishek Vulla</a></p>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<OptionsPage />);
}
