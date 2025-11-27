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

![Screenshot](screenshots/course-filter.png)

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
   git clone https://github.com/AbhishekVulla/deadline-center-extension.git
   cd deadline-center-extension
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
5. **Export to Calendar** → Click the calendar icon on any deadline to download `.ics`

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
deadline-center-extension/
├── src/
│   ├── popup/          # React popup UI
│   ├── content/        # Content scripts for eDimension & Gradescope
│   ├── options/        # Options page
│   └── lib/            # Shared utilities
├── public/             # Icons and static assets
├── manifest.json       # Extension manifest
├── package.json        # Dependencies
├── vite.config.ts      # Vite configuration
└── tsconfig.json       # TypeScript configuration
```

---

## Contributing

Contributions are welcome! If you want to:

- **Report a bug** → Open an issue
- **Request a feature** → Open an issue
- **Submit a fix** → Fork, make changes, open a PR

---

## Attribution

If you use this project or substantial parts of its codebase in coursework, research, or other projects, you must credit:

> **SUTD Deadline Center** – Abhishek Vulla  
> https://github.com/AbhishekVulla/deadline-center-extension

Please don't pass this off as your own original work.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built as part of a **Building 0** initiative at SUTD
- Thanks to all Freshmores who tested and provided feedback

---

**Made with caffeine and deadlines by [Abhishek Vulla](https://github.com/AbhishekVulla)**
