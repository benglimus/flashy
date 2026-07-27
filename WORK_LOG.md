# Work Log

## July 26, 2026 — Documentation Review + UI Refactor

### Markdown files review and update
Reviewed all 6 markdown files against actual source code and updated user/technical info:

| File | Changes |
|------|---------|
| `CLI_README.md` | Removed `.flashyrc.example` references (file doesn't exist), fixed config instructions, added `deck delete` command docs, updated file reference table, fixed alias path |
| `CLI_DESIGN.md` | Fixed config path (`~/.flashyrc` → CWD `.flashyrc`), added `deck delete` command, replaced "Files to Create" with accurate project file list |
| `SETUP.md` | Updated test function names to match actual code.gs (`testAuthentication`, `testGetDueCards`) |
| `IMPLEMENTATION_PLAN.md` | Fixed file structure (no subdirectory), updated component hierarchy (added LearnScreen, SettingsModal, removed Sidebar), updated state management, added `getAllDeckStats` to API table, marked all implementation phases as complete, updated key decisions, fixed testing strategy |
| `WORK_LOG.md` | Added July 26 entry |

### Created USER_MANUAL.md
Comprehensive user manual covering:
- Web app setup and usage (login, decks, cards, review mode, learning mode, progress, settings)
- CLI tool setup and all commands
- Data format reference (CSV, deck directories)
- Spaced repetition algorithm explanation
- Troubleshooting guide
- Gesture/keyboard cheat sheet

### Floating icon button UI refactor
Converted all screen action buttons from header text buttons to consistent floating circular icon buttons.

**Design system:** `w-14 h-14 rounded-full shadow-lg z-30 active:scale-95 transition-transform fixed right-6`

| Screen | Header changes | Floating buttons |
|--------|---------------|-----------------|
| `DeckListScreen` | Removed Settings header button | Gear icon (bottom-40), + FAB (bottom-24) |
| `DeckDetailScreen` | Removed Back, Learn, Review buttons | Arrow-left (bottom-72), Book (bottom-56), Refresh with badge (bottom-40), + FAB (bottom-24) |
| `ReviewScreen` | Removed Back text, centered counter | Arrow-left (bottom-24) |
| `LearnScreen` | Removed Back text from header | Arrow-left (bottom-24) |
| `ProgressScreen` | No header changes needed | Refresh icon (bottom-24) |

**Stacking layout:** Buttons stack bottom-up with 64px spacing: + FAB (24) → Settings/Review (40) → Learn (56) → Back (72)

### Bug fix: blank screen
- Root cause: A floating back button was incorrectly inserted inside `DeckListScreen`'s `decks.map()` loop from a previous session, referencing a non-existent `onBack` prop and breaking the JSX tree
- Babel standalone fails silently on JSX syntax errors, rendering a blank screen
- Fix: Removed the misplaced button and corrected nesting

### PWA manifest and icons

Added PWA installability for Android and mobile home screen:
- `manifest.json` — standalone display, dark theme/background color matching UI, portrait orientation
- `icon-192.png` (982B) — for notifications and home screen icons
- `icon-512.png` (3.1K) — for app drawer / play store listing
- Icons auto-generated via Python/Pillow: dark gray background with amber lightning bolt inside card outline
- Added `<link rel="manifest">` to `index.html`

### iPhone notch safe area fix

- Added top safe area padding to `#root` via `env(safe-area-inset-top)` so content doesn't overlap the status bar on notched iPhones
- reapplied from body (ineffective with h-screen/min-h-screen) to `#root` (the React container) for reliable positioning

### Git updates

| Commit | Description |
|--------|-------------|
| `093ed45` | Replace header action buttons with floating icon buttons across all screens |
| `e64bd71` | add PWA manifest and icons |
| `4aa4015` | add top safe area inset for iPhone notch |

---

## July 25, 2026

## Flashy CLI Tool

### Created `flashy/flashy.js`
Single-file Node.js CLI for managing decks and cards from the terminal. No npm dependencies — uses built-in `fetch` and `crypto`.

**Commands:**
- `deck list` — List all decks with card count
- `deck export <deckId> [dir]` — Export deck to directory (data.csv + photos)
- `deck import <dir>` — Import deck from directory
- `deck delete <deckId>` — Delete a deck
- `card list <deckId>` — List cards in a deck
- `card import <deckId> <file.csv>` — Bulk import cards from CSV

**Config:** `.flashyrc` in current working directory with `{"url":"...","userid":"...","password":"..."}`

### Created supporting files
- `flashy/CLI_DESIGN.md` — Design document
- `flashy/README.md` — Full usage documentation
- `flashy/.flashyrc.example` — Sample config

## Deck Creation via CLI

### Korean Vocabulary Deck (ID: 100001)
- 133 cards covering greetings, numbers, food, colors, people, places, common phrases
- Each card includes Hangul, romanization, and English translation
- Created via `deck import` with directory-based format

### AI Terminology Deck (ID: 100002)
- 229 cards covering ML/AI concepts from basics to advanced
- Topics: neural networks, LLMs, training, optimization, safety, ethics, deployment
- Created via `deck import` with directory-based format

## Performance Optimizations

### Backend (`code.gs`)
- Added `buildCardStateMap()` — reads CardState sheet once, builds lookup map (O(n) vs O(n*m))
- Added `getAllDeckStats` endpoint — returns stats for all decks in a single call
- Updated `handleGetDeckStats` and `handleGetDueCards` to use the map
- Fixed `handleGetDecks` to count only active cards (was using `getLastRow()` which included deleted cards)

### Frontend (`app.js`)
- `DeckListScreen` now uses `Promise.all()` to fetch decks + stats in parallel (2 requests instead of N+1)

## Learning Mode Feature

### Created `LearnScreen` component (~140 lines)
- Loads all cards via `getCards` endpoint (not just due cards)
- Tap to flip (3D animation, same as ReviewScreen)
- Swipe left/right for next/previous card
- Previous/Next/Shuffle buttons at bottom
- Card counter in header ("3 / 42")
- Cards wrap around (last → first)
- No SRS ratings — purely for studying

### Updated `DeckDetailScreen`
- Added "Learn" button (green) side-by-side with "Review" button (blue)
- Learn visible when deck has cards, Review only when due cards exist

### Updated `App` router
- Added `handleLearn` handler and `screen === 'learn'` route

### Created `LEARNING_MODE_SPEC.md`
- Full design spec for learning mode feature

## Bug Fixes

### Card flip in Learning Mode
- Fixed double-firing issue where both `onTouchEnd` and `onClick` toggled the card on mobile
- Solution: `onClick` handles flip (works on both mobile and desktop), `onTouchEnd` handles swipe detection only

### Deck card count
- Fixed `handleGetDecks` to count only active cards instead of using `getLastRow()` which included soft-deleted cards

## Git Updates

| Commit | Description |
|--------|-------------|
| `12bbe58` | Initial commit: Flashy app + CLI + decks |
| `174e0e7` | Update .gitignore: exclude temp import files |
| `4d76327` | Remove .md, .gs, flashy.js from tracking |
| `6c3e4de` | Ignore *.csv and lsl.example |
| `68fa66f` | Remove .gitignore from tracking |
| `caf6075` | Optimize deck loading: parallel API calls + getAllDeckStats |
| `cf84476` | Add learning mode: LearnScreen with card browsing, shuffle, swipe |
| `17c08e0` | Fix card flip: use onClick only, touch handlers for swipe only |

## Files Modified/Created Today

| File | Action |
|------|--------|
| `flashy/flashy.js` | Created — CLI tool |
| `flashy/CLI_DESIGN.md` | Created — Design doc |
| `flashy/README.md` | Created — Usage docs |
| `flashy/.flashyrc.example` | Created — Sample config |
| `flashy/LEARNING_MODE_SPEC.md` | Created — Learning mode spec |
| `app.js` | Modified — Performance optimizations, learning mode, bug fixes |
| `code.gs` | Modified — Performance optimizations (not in git) |
