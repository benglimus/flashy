# Flashy — Setup Guide

## Prerequisites

- Google account
- Google Sheets access
- Local web server (Python 3 or Node.js)
- iPhone or Mac with Safari for testing

---

## 1. Create the Google Spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Click **+ Blank** to create a new spreadsheet
3. Name it `Flashy`
4. Rename the default sheet tab to `Config` (double-click the tab at the bottom)
5. Add the remaining 4 tabs by clicking the **+** button at the bottom:

| Tab Name | Purpose |
|----------|---------|
| `Config` | App configuration (SRS defaults, counters) |
| `Users` | User credentials and status |
| `Decks` | Deck metadata (id, name, description, status) |
| `Logs` | Review session logs |
| `CardState` | Per-user SRS state per card |

> **Note:** Each deck automatically gets its own sheet tab (e.g., `Deck_100000`, `Deck_100001`) when created via the app. Do NOT manually create deck sheets.

---

## 2. Populate Each Sheet

### Config Sheet

| A (Key) | B (Value) |
|---------|-----------|
| NEXT_DECK_ID | 100001 |
| NEXT_CARD_ID | 100001 |
| NEXT_LOG_ID | 100001 |
| PHOTOS_FOLDER_PATH | Flashy/Photos |
| SRS_EASE_FACTOR | 2.5 |
| SRS_GRADUATE_INTERVAL | 1 |
| SRS_EASY_INTERVAL | 4 |
| SRS_STARTING_EASE | 2.5 |

### Users Sheet

| A (userid) | B (password) | C (name) | D (status) |
|------------|-------------|----------|------------|
| admin | yourPassword | Admin | Active |

> Replace `yourPassword` with your actual password. This is stored as plaintext — the server hashes it for comparison. Plaintext never leaves the sheet.

### Decks Sheet

| A (id) | B (name) | C (description) | D (created) | E (unused) | F (status) |
|--------|----------|-----------------|-------------|------------|------------|

Leave empty — rows are added by the app. The header row is required.

### Logs Sheet

| A (id) | B (userId) | C (deckId) | D (cardId) | E (rating) | F (responseTimeMs) | G (timestamp) | H (sessionBatchId) |
|--------|-----------|-----------|-----------|-----------|-------------------|---------------|-------------------|

Leave empty — rows are added by the app.

### CardState Sheet

| A (userId) | B (cardId) | C (easeFactor) | D (intervalDays) | E (dueDate) | F (reviewCount) |
|-----------|-----------|---------------|-----------------|-------------|----------------|

Leave empty — rows are added by the app.

### Deck Sheets (Auto-created)

When you create a deck via the app, a new sheet tab is automatically created with the name `Deck_<id>` (e.g., `Deck_100000`). Each deck sheet has this structure:

| A (id) | B (question) | C (answer) | D (notes) | E (photoUrl) | F (created) | G (modified) | H (status) |
|--------|-------------|-----------|-----------|-------------|-------------|--------------|------------|

Cards are stored directly in the deck's sheet tab. This keeps decks isolated and makes it easy to export/import individual decks.

---

## 3. Set Up Google Apps Script

1. In your `Flashy` spreadsheet, go to **Extensions > Apps Script**
2. Delete any default code in `Code.gs`
3. Paste the contents of `code.gs` (from this project) into the editor
4. Click **Save** (floppy disk icon or Ctrl/Cmd + S)
5. Name the project `Flashy Backend` when prompted

---

## 4. Deploy as Web App

1. In the Apps Script editor, click **Deploy > New deployment**
2. Click the gear icon and select **Web app**
3. Configure:
   - **Description**: `Flashy API`
   - **Execute as**: `Me` (your Google account)
   - **Who has access**: `Anyone` (required for unauthenticated login endpoint)
4. Click **Deploy**
5. Authorize when prompted (review permissions, click Allow)
6. Copy the **Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
7. Save this URL — you'll enter it in the app's login screen

### Updating After Code Changes

1. Go to **Extensions > Apps Script**
2. Make your changes, **Save**
3. Click **Deploy > Manage deployments**
4. Click the pencil icon next to your current deployment
5. Select **New version**
6. Click **Deploy**
7. The URL stays the same — no need to re-enter it in the app

---

## 5. Create the Photos Folder

1. Go to [drive.google.com](https://drive.google.com)
2. Click **New > New folder**
3. Name it `Flashy`
4. Open it, create a subfolder named `Photos`
5. The full path is `Flashy/Photos` — this matches the `PHOTOS_FOLDER_PATH` in Config

> The app will also auto-create this folder on first photo upload if it doesn't exist.

---

## 6. Local Development Setup

### Option A: Python (recommended)

```bash
cd /Users/benglim/Developer/flashy
python3 -m http.server 9100
```

Open `http://localhost:9100` in your browser.

### Option B: For iPhone Testing

```bash
cd /Users/benglim/Developer/flashy
python3 -m http.server 9100 --bind 0.0.0.0
```

1. Find your Mac's local IP (System Settings > Wi-Fi > Details > TCP/IP)
2. On your iPhone, open Safari and visit `http://YOUR_IP:9100`
3. Both devices must be on the same Wi-Fi network

### Option C: Node.js

```bash
cd /Users/benglim/Developer/flashy
npx serve -l 9100
```

---

## 7. First Login

1. Open the app in your browser
2. Enter the **Web App URL** from Step 4
3. Enter your **User ID** (e.g., `admin`)
4. Enter your **Password** (the plaintext value from the Users sheet)
5. Click **Login**

You should see the empty DeckListScreen with no decks yet.

---

## 8. Create Your First Deck

1. Tap the **+** button (bottom-right)
2. Enter a name (e.g., "Spanish Vocabulary")
3. Enter an optional description
4. Tap **Create**
5. Tap the new deck to open it
6. Tap **+** to add cards
7. Enter a question and answer, tap **Add**
8. Add several cards, then start a review session

---

## 9. Testing the Backend

Run these from the Apps Script editor (Extensions > Apps Script > select from dropdown > Run):

| Function | What It Tests |
|----------|--------------|
| `testAuthentication` | Verifies password hash round-trip works |
| `testVerifyAuthWithFirstUser` | Tests auth with the first Users row |
| `testDoPost` | Simulates a POST login request |

Check **Execution log** (View > Logs) for results. All tests should show `PASSED`.

---

## 10. iPhone Home Screen (PWA-lite)

To use Flashy like a native app:

1. Open the app in Safari on your iPhone
2. Tap the **Share** button (square with arrow)
3. Tap **Add to Home Screen**
4. Name it `Flashy`, tap **Add**

The app now launches from your home screen in full-screen mode (no Safari chrome).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Network error — check URL" on login | Most likely cause: `crypto.subtle` requires HTTPS or `localhost`. If accessing via `http://192.168.x.x:9100`, the app now includes a pure JS SHA-256 fallback — but verify the GAS Web App URL is correct and deployed |
| "Unauthorized" on login | Check password matches plaintext in Users sheet; verify status is `Active` |
| Blank screen after login | Open browser console (Safari: Develop > Show Web Inspector); check for CORS or fetch errors |
| Photos not loading | Verify Google Drive folder `Flashy/Photos` exists; check sharing settings |
| "Script not authorized" | Re-deploy: Deploy > Manage deployments > Edit > New version > Deploy |
| POST returns empty | GAS CORS workaround requires `Content-Type: text/plain` — verify `apiPost` helper sends this |
| Swipe not working | Ensure touch events aren't blocked by parent elements; test with 50px+ swipe distance |
