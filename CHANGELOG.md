# Changelog

## v1.3.1 (September 2026)
- Fix: search box no longer pushed off-screen when a course has a very long name

## v1.3.0 (May 2026)
- When adding your own deadline, course is now a dropdown of existing courses (no more accidental duplicates from typos)
- Removed the "Type" field from the Add/Edit modal (wasn't used anywhere)
- Modal redesign: consistent blue buttons, outlined Cancel, darker panel

## v1.2.1 (March 2026)
- Fix parsing of revised deadlines ("Due date 2:", "Due date 3:", etc.) that eDimension uses when professors extend due dates

## v1.2.0 (February 2026)
- Compact UI redesign: 2-line rows replace chunky cards (3x more deadlines visible)
- Actions (Source, Edit, .ics) hidden behind click-to-expand
- DEBUG flag pattern for content script logging (63 statements guarded)
- Calendar export: removed empty LOCATION field and redundant newlines
- Options page: removed dead Auto-Confirm Threshold, added attribution
- Empty state: improved readability on dark background
- Course name normalizer: preserve XX.XXX course code prefix

## v1.1.5 (January 2026)
- Fix Gradescope year parsing by extracting term year from `.courseHeader--term` and passing `contextYear` to parser
- Prevents old 2025 deadlines from appearing as 2026 deadlines after New Year

## v1.1.4 (December 2025)
- Fix "visible deadlines" consistency across list, export count, and course dropdown
- Ghost courses no longer appear in dropdown

## v1.1.3 (December 2025)
- Overdue section collapsed by default
- Auto-hide overdue items after 3 days past due

## v1.1.2 (December 2025)
- Remove unused permissions (Chrome Web Store compliance)

## v1.1.1 (December 2025)
- Remove broken Refresh button

## v1.1.0 (December 2025)
- Add "Export Visible" button for bulk .ics export
- Add per-item "Download .ics" button

## v1.0.0 (November 2025)
- Initial release
- eDimension and Gradescope deadline extraction
- Unified dashboard with filtering and search
- Calendar export functionality
