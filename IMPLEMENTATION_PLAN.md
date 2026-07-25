# Flashy — Implementation Plan

## Overview

Mobile-first flashcard app for iPhone Safari, built on the same architecture as the Inventory app: single-file React SPA + Google Apps Script backend + Google Sheets database. Each deck is a sheet tab. Session logging feeds spaced repetition and progress analytics.

**Target directory:** `/Users/benglim/Developer/flashy/`

---

## 1. File Structure

```
flashy/
├── index.html          # HTML shell (React 18, Tailwind, Babel via CDN)
├── app.js              # Entire React SPA
├── code.gs             # Google Apps Script backend
├── SETUP.md            # Setup instructions
├── TECHNICAL.md        # Technical documentation
└── IMPLEMENTATION_PLAN.md
```

---

## 2. Spreadsheet Schema

### Config Sheet

| Key | Value |
|-----|-------|
| `NEXT_DECK_ID` | `100001` (auto-increment) |
| `NEXT_CARD_ID` | `100001` (auto-increment) |
| `NEXT_LOG_ID` | `100001` (auto-increment) |
| `PHOTOS_FOLDER_PATH` | `Flashy/Photos` |
| `SRS_EASE_FACTOR` | `2.5` (default ease) |
| `SRS_GRADUATE_INTERVAL` | `1` (days) |
| `SRS_EASY_INTERVAL` | `4` (days) |
| `SRS_STARTING_EASE` | `2.5` |

### Users Sheet

| Column A | Column B | Column C | Column D |
|----------|----------|----------|----------|
| userid | password (plaintext) | name | status (`Active`/`Inactive`) |

Same as Inventory — plaintext stored, hashed server-side for comparison.

### Decks Sheet

| Column A | Column B | Column C | Column D | Column E | Column F |
|----------|----------|----------|----------|----------|----------|
| id | name | description | created | (unused) | status |

- **id**: Sequential 6-digit string (e.g., `100000`)
- **name**: Deck display name (e.g., "Spanish Vocabulary")
- **description**: Optional description
- **created**: ISO timestamp
- **status**: `Active` / `Inactive` (soft delete)

### Deck Sheets (One per deck)

Each deck gets its own sheet tab named `Deck_<id>` (e.g., `Deck_100000`, `Deck_100001`).

| Col A | Col B | Col C | Col D | Col E | Col F | Col G | Col H |
|-------|-------|-------|-------|-------|-------|-------|-------|
| id | question | answer | notes | photoUrl | created | modified | status |

- **id**: Sequential 6-digit string
- **question**: Card front (text)
- **answer**: Card back (text)
- **notes**: Optional extra context
- **photoUrl**: Optional image URL (Google Drive)
- **created**: ISO timestamp
- **modified**: ISO timestamp
- **status**: `Active` / `Inactive`

> **Benefits:** Decks are isolated. Easy to export/import individual decks. No cross-deck queries needed for most operations.

### Logs Sheet

| Col A | Col B | Col C | Col D | Col E | Col F | Col G | Col H |
|-------|-------|-------|-------|-------|-------|-------|-------|
| id | userId | deckId | cardId | rating | responseTimeMs | timestamp | sessionBatchId |

- **id**: Sequential 6-digit string
- **userId**: Who reviewed
- **deckId**: Which deck
- **cardId**: Which card
- **rating**: `1` (Again), `2` (Hard), `3` (Good), `4` (Easy)
- **responseTimeMs**: Time from card flip to rating
- **timestamp**: ISO timestamp
- **sessionBatchId**: UUID grouping one review session's logs together

### CardState Sheet (SRS metadata per user per card)

| Col A | Col B | Col C | Col D | Col E | Col F |
|-------|-------|-------|-------|-------|-------|
| userId | cardId | easeFactor | intervalDays | dueDate | reviewCount |

- **userId + cardId**: Composite key (unique per row)
- **easeFactor**: SM-2 ease factor (default 2.5)
- **intervalDays**: Current interval
- **dueDate**: Next review date (ISO)
- **reviewCount**: Total times reviewed

---

## 3. Backend API (`code.gs`)

### GET Endpoints

| Endpoint | Auth | Parameters | Response |
|----------|------|------------|----------|
| `login` | No | `pwHash` | `{ status, user: { userid, name } }` |
| `getDecks` | Yes | — | `{ status, decks: [...] }` |
| `getCards` | Yes | `deckId` | `{ status, cards: [...] }` |
| `getCard` | Yes | `cardId` | `{ status, card: {...} }` |
| `getDueCards` | Yes | `deckId` | `{ status, cards: [...] }` (sorted by dueDate ascending, filtered to due today) |
| `getCardState` | Yes | `cardId` | `{ status, state: {...} }` |
| `getDeckStats` | Yes | `deckId` | `{ status, stats: { total, dueToday, reviewed, mastered } }` |
| `getSessionLogs` | Yes | `deckId`, `userId`, optional `from`, `to` | `{ status, logs: [...] }` |
| `getProgress` | Yes | `deckId`, `userId` | `{ status, progress: { accuracy, streak, weakCards, suggestions } }` |
| `searchCards` | Yes | `query`, `deckId` (optional) | `{ status, cards: [...] }` |

### POST Endpoints

| Endpoint | Parameters | Response |
|----------|------------|----------|
| `createDeck` | `name`, `description` | `{ status, id }` |
| `updateDeck` | `id`, `name`, `description` | `{ status }` |
| `deleteDeck` | `id` | `{ status }` (soft delete deck + cards) |
| `createCard` | `deckId`, `question`, `answer`, `notes`, `photoUrl` | `{ status, id }` |
| `updateCard` | `id`, `question`, `answer`, `notes`, `photoUrl` | `{ status }` |
| `deleteCard` | `id` | `{ status }` (soft delete) |
| `rateCard` | `cardId`, `deckId`, `rating`, `responseTimeMs`, `sessionBatchId` | `{ status, nextReview: { dueDate, intervalDays, easeFactor } }` |
| `uploadPhoto` | `photoData`, `photoName` | `{ status, photoUrl }` |

### SRS Algorithm (SM-2 Variant)

Applied server-side in `rateCard`:

```
if rating == 1 (Again):
    intervalDays = 1
    easeFactor = max(1.3, easeFactor - 0.2)
elif rating == 2 (Hard):
    intervalDays = max(1, intervalDays * 1.2)
    easeFactor = max(1.3, easeFactor - 0.15)
elif rating == 3 (Good):
    if reviewCount == 0: intervalDays = 1
    elif reviewCount == 1: intervalDays = 6
    else: intervalDays = intervalDays * easeFactor
elif rating == 4 (Easy):
    if reviewCount == 0: intervalDays = 4
    else: intervalDays = intervalDays * easeFactor * 1.3
    easeFactor = easeFactor + 0.15

dueDate = today + intervalDays
```

### Progress & Suggestions Engine

The `getProgress` endpoint reads `Logs` and `CardState` to compute:

1. **Accuracy** — percentage of `rating >= 3` across all reviews in a time window
2. **Streak** — consecutive days with at least one review
3. **Weak Cards** — cards with `easeFactor < 2.0` or `rating == 1` in last 5 reviews
4. **Suggestions**:
   - If weak cards exist: "Focus on these cards: [list]"
   - If no reviews today: "You haven't reviewed today — X cards due"
   - If accuracy < 60%: "Consider slowing down — try fewer cards per session"
   - If accuracy > 90% for 5+ days: "You're ready for more — try adding new cards"

---

## 4. Frontend Components (`app.js`)

### Component Hierarchy

```
App
├── AuthScreen                    # Login form (identical pattern to Inventory)
├── DeckListScreen                # Grid/list of decks with stats
│   ├── DeckCard                  # Single deck preview (name, card count, due count)
│   └── AddDeckModal              # Create new deck
├── ReviewScreen                  # Card review session
│   ├── FlashCard                 # Flippable card (question/answer)
│   └── RatingButtons             # Again / Hard / Good / Easy (bottom)
├── DeckDetailScreen              # Deck management
│   ├── CardListTab               # List of cards in deck
│   ├── StatsTab                  # Deck statistics and progress
│   └── AddCardModal              # Create/edit card
├── ProgressScreen                # Global progress across all decks
│   ├── AccuracyChart             # Simple accuracy over time
│   ├── StreakDisplay             # Current streak
│   └── WeakCardsList             # Cards needing attention
├── SettingsModal                 # Same pattern as Inventory
└── Sidebar                       # Bottom sheet (mobile) / side panel (desktop)
```

### State Management

All state in `App` via `useState`:

| State | Type | Purpose |
|-------|------|---------|
| `session` | object | Auth session (`url`, `pwHash`, `userid`, `name`) |
| `screen` | string | Active screen: `decks`, `review`, `detail`, `progress` |
| `decks` | array | All active decks |
| `currentDeck` | object | Currently selected deck |
| `cards` | array | Cards in current deck |
| `dueCards` | array | Cards due for review in current deck |
| `currentCardIndex` | number | Position in dueCards during review |
| `cardFlipped` | boolean | Whether current card is flipped |
| `sessionBatchId` | string | UUID for current review session |
| `sessionStats` | object | `{ reviewed, correct, startTime }` |
| `dark` | boolean | Dark mode |
| `showSettings` | boolean | Settings modal |
| `sidebarOpen` | boolean | Sidebar visibility |

### localStorage Keys

| Key | Contents |
|-----|----------|
| `flashy_api_url` | GAS Web App URL |
| `flashy_session` | JSON session object |
| `flashy_settings` | Saved credentials |
| `flashy_dark` | Dark mode flag |

---

## 5. Screen-by-Screen UX Design

### AuthScreen
Identical to Inventory — URL, userid, password fields, login button.

### DeckListScreen
- Header: "Flashy" + settings gear
- Grid of deck cards (2 columns on mobile, 3 on desktop)
- Each deck card shows: name, card count, due today count (badge)
- Floating "+" button (bottom-right) to add deck
- Tap deck → navigate to ReviewScreen (if cards due) or DeckDetailScreen

### ReviewScreen (Core Experience)
- **Full-screen card** centered vertically
- **Tap card** → flip animation (CSS transform rotateY)
- **After flip**, rating buttons appear at bottom:
  - Red "Again" (left), Orange "Hard" (center-left), Green "Good" (center-right), Blue "Easy" (right)
  - All buttons in thumb zone (bottom 20% of screen)
- **Progress bar** at top: "3 / 15 cards"
- **Swipe gestures**:
  - Swipe up on card → same as "Good"
  - Swipe down → skip card (no rating)
- **Session complete** → summary screen (accuracy, time, weak cards)
- **One-handed**: entire flow operable with right thumb from bottom-center

### DeckDetailScreen
- Tab bar: "Cards" | "Stats"
- Cards tab: scrollable list with search, each card shows question preview + edit/delete
- Stats tab: accuracy %, reviews today, streak, weak cards list
- FAB: "+" to add card

### ProgressScreen
- Global stats across all decks
- Accuracy trend (simple text-based, no chart library)
- Current streak
- Weakest cards list (tap to go to that card in its deck)

---

## 6. Image Handling

Same as Inventory:
- `compressImage(file, maxWidth=1280, quality=0.7)` via canvas
- Upload as base64 to `uploadPhoto` endpoint
- Store in Google Drive folder `Flashy/Photos`
- Display via `lh3.googleusercontent.com/d/` CDN URL conversion
- Cards can have optional photos on front (question side)

---

## 7. Implementation Order

### Phase 1: Foundation (Backend)
1. Create spreadsheet with all 6 sheets (Config, Users, Decks, Cards, Logs, CardState)
2. Write `code.gs` — auth, CRUD for Decks and Cards, photo upload
3. Deploy GAS as Web App, test endpoints with `test_api.sh`

### Phase 2: Foundation (Frontend)
4. Create `index.html` (CDN deps, viewport meta, safe area)
5. Create `app.js` — AuthScreen, DeckListScreen, basic navigation
6. Create deck CRUD (add, edit, delete deck)

### Phase 3: Core Review Flow
7. Implement `getDueCards` endpoint with SM-2 filtering
8. Implement `rateCard` endpoint with SM-2 algorithm
9. Build ReviewScreen with flashcard flip, rating buttons, progress bar
10. Add swipe gestures (tap flip, swipe up = Good, swipe down = skip)
11. Add session batch tracking (UUID per review session)

### Phase 4: Cards CRUD
12. Build CardListTab, AddCardModal, edit/delete cards
13. Add photo upload support for cards
14. Add searchCards endpoint and search UI

### Phase 5: Analytics & Progress
15. Implement `getDeckStats` endpoint
16. Implement `getProgress` endpoint with accuracy, streak, weak cards, suggestions
17. Build StatsTab in DeckDetailScreen
18. Build ProgressScreen (global view)

### Phase 6: Polish
19. Dark mode (same pattern as Inventory)
20. Settings modal (same pattern as Inventory)
21. Sidebar with actions (same pattern as Inventory)
22. Loading states, error handling, empty states
23. Session summary screen after review completion
24. Write `SETUP.md` and `TECHNICAL.md`

---

## 8. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SRS Algorithm | SM-2 variant | Proven, simple, well-understood |
| Card rating scale | 1-4 (Again/Hard/Good/Easy) | Matches Anki convention |
| Session tracking | UUID batch ID per session | Groups logs for per-session analytics |
| Card state storage | Separate CardState sheet | Avoids recomputing SRS on every read |
| Review filtering | Server-side `getDueCards` | Client just receives sorted due list |
| Photo support | Same as Inventory (Drive + CDN) | Proven pattern, no new infra |
| Progress calculation | Server-side in `getProgress` | Keeps client thin, leverages GAS compute |

---

## 9. GAS Constraints & Mitigations

| Constraint | Mitigation |
|------------|------------|
| 6-min execution limit | `getDueCards` paginates if >500 cards; logs written one at a time |
| 50MB POST limit | Photo compression before upload (~500KB per image) |
| No concurrent edit | Last-write-wins (acceptable for personal use) |
| Sheet row limits (10M cells) | Decks = separate tabs; Logs can be pruned periodically |
| CORS on POST | `Content-Type: text/plain` workaround (proven in Inventory) |
| No real-time | Manual refresh; review session fetches all due at start |

---

## 10. Testing Strategy

- `testAuthentication()` — same as Inventory
- `testCreateDeck()` — create deck, verify row
- `testCreateCard()` — create card in deck, verify row
- `testRateCard()` — rate card, verify CardState update
- `testGetDueCards()` — verify due filtering works
- `testGetProgress()` — verify accuracy/streak computation
- Frontend: manual testing on iPhone Safari (primary target)
