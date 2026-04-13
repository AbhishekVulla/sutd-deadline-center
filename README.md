# SUTD Deadline Center

> Chrome extension for SUTD students that pulls deadlines from **eDimension** and **Gradescope** into one clean dashboard with calendar export.

**Created by [Abhishek Vulla](https://github.com/AbhishekVulla)** · SUTD Class of 2029 · Building 0 Initiative

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Published-green?logo=googlechrome)](https://chromewebstore.google.com/detail/sutd-deadline-center/didnpjogdamalaggfnidojaoconlobpk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## The Problem

Deadlines are scattered across eDimension, Gradescope, and random chats. Students keep checking multiple pages and still miss things.

## The Solution

SUTD Deadline Center automatically extracts all your deadlines and displays them in one unified dashboard inside your browser.

![eDimension Dashboard](screenshots/main-view.png)

![Gradescope + Course Filter](screenshots/course-filter.png)

![Calendar Export to Google Calendar](screenshots/calendar-export.png)

---

## Features

- **Auto-extraction** from eDimension Calendar and Gradescope assignments
- **Unified dashboard** - all deadlines in one place
- **Course filtering** - filter by course code (10.013, 10.015, 01.010, etc.)
- **Search** - find deadlines by keyword
- **Calendar export** - export to `.ics` and import into Google Calendar
- **Manual deadlines** - add custom deadlines
- **Privacy-first** - all data stays local in your browser, no external servers

---

## Installation

### Option 1: Chrome Web Store (Recommended)

1. Go to [SUTD Deadline Center on Chrome Web Store](https://chromewebstore.google.com/detail/sutd-deadline-center/didnpjogdamalaggfnidojaoconlobpk)
2. Click "Add to Chrome"
3. Done!

### Option 2: Load from Source (Developers)

1. Clone this repo:
   ```bash
   git clone https://github.com/AbhishekVulla/sutd-deadline-center.git
   cd sutd-deadline-center
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist/` folder

---

## How to Use

1. **Visit eDimension** → Go to the [Calendar/Deadline page](https://edimension.sutd.edu.sg/ultra/deadline)
2. **Visit Gradescope** → Open any course page (e.g., `gradescope.com/courses/12345`)
3. **Click the extension icon** → See all your deadlines in one dashboard
4. **Filter & Search** → Use the dropdown to filter by course
5. **Export to Calendar** → Click any deadline to expand, then download `.ics`

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Chrome Extension Manifest V3 | Extension framework |
| React 18 + TypeScript | UI components |
| Vite | Build tool |
| Day.js | Date parsing & timezone handling |
| Chrome Storage API | Local data persistence |

---

## Project Structure

```
sutd-deadline-center/
├── src/
│   ├── popup/          # React popup UI
│   ├── content/        # Content scripts for eDimension & Gradescope
│   ├── options/        # Options page
│   ├── parsing/        # Date parsing & normalization
│   └── config/         # DOM selectors configuration
├── public/             # Icons and static assets
├── manifest.json       # Extension manifest
├── package.json        # Dependencies
├── vite.config.ts      # Vite configuration
└── tsconfig.json       # TypeScript configuration
```

---

## Privacy & Data

- **Local Only**: All data stored in `chrome.storage.local`
- **No Network Calls**: Extension makes zero external requests
- **No Credentials**: Never accesses or stores passwords
- **No Grades**: Only extracts publicly visible deadline text

---

## Contributing

Contributions are welcome! If you want to:
- **Report a bug** → Open an issue
- **Request a feature** → Open an issue
- **Submit a fix** → Fork, make changes, open a PR

---

## Attribution

If you use this project or substantial parts of its codebase in coursework, research, or other projects, please credit:

**Abhishek Vulla** - https://github.com/AbhishekVulla

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

Built for SUTD students.
