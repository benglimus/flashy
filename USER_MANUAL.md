# Flashy User Manual

A complete guide to using the Flashy flashcard app — both the web app and the CLI tool.

---

## Table of Contents
 
1. [What Is Flashy?](#what-is-flashy)
2. [What You'll Need](#what-youll-need)
3. [Setting Up](#setting-up)
4. [Using the Web App](#using-the-web-app)
5. [Using the CLI](#using-the-cli)
6. [Data Format Reference](#data-format-reference)
7. [Spaced Repetition Explained](#spaced-repetition-explained)
8. [Troubleshooting](#troubleshooting)

---

## What Is Flashy?

Flashy is a mobile-first flashcard app with spaced repetition (SM-2 algorithm). It runs as a web app in your browser (optimized for iPhone Safari). Deck and card content is stored in a Google Sheets spreadsheet via a Google Apps Script backend; your review history and spaced-repetition state are stored on the device that studies them.

**Two ways to use it:**

| Interface | What it does |
|-----------|-------------|
| **Web App** | Study and review downloaded decks with spaced repetition; track progress on your device |
| **CLI Tool** | Manage data from the terminal — create or import decks and cards, export, and back up / restore |

---

## What You'll Need

- A **Google account** (for Sheets and Apps Script)
- **Node.js 18+** (only if using the CLI tool)
- An **iPhone with Safari** or any modern browser for the web app

---

## Setting Up

### 1. Create the Google Spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet named `Flashy`
2. Rename the default tab to `Config`
3. Add these tabs (click the **+** button at the bottom):

| Tab | Purpose |
|-----|---------|
| `Config` | App settings and ID counters |
| `Users` | User accounts |
| `Decks` | Deck metadata |
| `Logs` | Review session logs |
| `CardState` | Per-user SRS state per card |

> Each deck also gets its own tab automatically (e.g., `Deck_100000`) when created via the app.

### 2. Set Up the Config Sheet

Fill in the Config sheet with these rows:

| Key | Value | Used? |
|-----|-------|-------|
| `NEXT_DECK_ID` | `100001` | Yes — next deck ID counter |
| `NEXT_CARD_ID` | `100001` | Yes — next card ID counter |
| `NEXT_LOG_ID` | `100001` | Yes — next review-log ID counter |
| `PHOTOS_FOLDER_PATH` | `Flashy/Photos` | Yes — where photos are stored |
| `SRS_EASE_FACTOR` | `2.5` | _Reserved — not read yet_ |
| `SRS_GRADUATE_INTERVAL` | `1` | _Reserved — not read yet_ |
| `SRS_EASY_INTERVAL` | `4` | _Reserved — not read yet_ |
| `SRS_STARTING_EASE` | `2.5` | _Reserved — not read yet_ |

The first four keys are used by the backend (the three ID counters and the photos path). The four `SRS_*` keys are **reserved**: the spaced-repetition math currently hardcodes its own values (starting ease `2.5`, graduate interval `1` day, easy interval `4` days, ease range `1.3`–`1.5` per rate), so changing those four cells has no effect until the algorithm is wired to read them.

### 3. Create Your User Account

In the **Users** sheet, add:

| userid | password | name | status |
|--------|----------|------|--------|
| `admin` | `yourPassword` | Your Name | `Active` |

> The password is stored as plaintext in the **Users** sheet. It is hashed (SHA-256) before being sent over the network, so only the hash travels in transit. Because the sheet itself holds the plaintext, treat that row as a secret: use a long, unique passphrase and keep the sheet private (unsalted SHA-256 is trivial to crack for anyone who can read the sheet).

### 4. Deploy the Google Apps Script Backend

1. In your spreadsheet, go to **Extensions > Apps Script**
2. Delete any default code in `Code.gs`
3. Paste the contents of `code.gs` from this project
4. Click **Save**
5. Go to **Deploy > New deployment**
6. Select **Web app**, configure:
   - **Execute as**: Me
   - **Who has access**: Anyone
7. Click **Deploy** and authorize
8. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/AKfycbx.../exec`)

### 5. Set Up the Photos Folder

1. Go to [drive.google.com](https://drive.google.com)
2. Create a folder named `Flashy`
3. Inside it, create a subfolder named `Photos`

The app will also auto-create this folder on first photo upload if it doesn't exist.

### 6. Start the Web App

The web app is a single HTML file. Serve it with any local web server:

```bash
# Python (recommended)
python3 -m http.server 9100

# Or Node.js
npx serve -l 9100
```

Open `http://localhost:9100` in your browser.

### 7. Install as iPhone Home Screen App (Optional)

1. Open the app in Safari on your iPhone
2. Tap the **Share** button (square with arrow)
3. Tap **Add to Home Screen**
4. Name it `Flashy`, tap **Add**

The app launches from your home screen in full-screen mode.

---

## Using the Web App

### Logging In

1. Enter your **GAS Web App URL** (from Step 4 above)
2. Enter your **User ID** (e.g., `admin`)
3. Enter your **Password** (the plaintext value from the Users sheet)
4. Tap **Login**

Your credentials are saved locally so you don't have to re-enter them.

### The Decks Screen

After login you see the **Decks** screen. It shows the decks you have **downloaded** to this device. Each deck card shows:

- **Deck name**
- **Description** (if set)
- **Card count** (e.g., "42 cards")
- **Due today** badge (e.g., "5 due") — only shown when cards need review

**Bottom tab bar:**

| Tab | What it shows |
|-----|---------------|
| **Decks** | Your downloaded decks |
| **Progress** | Global stats across all your local reviews |

**Downloading decks:**

The web app is a study client, so decks must be pulled down to your device before you can study them.

1. On the Decks screen, open the menu (**⋮**, top-right)
2. Tap **Download decks** — this lists the decks available on the server
3. Tap **Download** next to each deck you want; that deck's cards are saved to the device

The same menu offers **Export stats** (a JSON dump of your local stats and review logs) and **Clear local decks** (removes every downloaded deck and the local review log from this device; the server is untouched). To add, update, or remove decks and cards, use the **CLI** (below).

### Deck Detail

Tap any deck to open its detail view. This screen has two tabs (in the web app both are **read-only**: you study and inspect, you don't edit cards here).

#### Cards Tab

Shows every card in the deck. Each card displays:

- **Front**
- **Back**
- **Notes** (if any; a `[SPEAK:]` tag line is hidden and instead powers the speaker button)

**Cards are read-only in the web app.** There are no add, edit, or delete buttons in the app's UI. To create, update, or delete cards — and to attach a photo to a card — use the **CLI** (below). Downloading a deck also pulls a fresh copy of its cards into the app.

#### Stats Tab

Shows statistics for this deck, all computed from the review data stored on your device:

| Stat | Meaning |
|------|---------|
| **Total Cards** | Number of cards in the deck |
| **Due Today** | Cards that need review right now |
| **Reviewed Today** | Cards you've already reviewed today |
| **Mastered** | Cards whose interval is 21 days or more |

Cross-deck stats — accuracy, day streak, weak cards, and a per-deck list — are on the **Progress** screen.

#### Header Buttons

| Button | When visible | What it does |
|--------|-------------|--------------|
| **Learn** (green) | Deck has any cards | Opens Learning Mode |
| **Review** (blue) | Cards are due today | Opens Review Mode with due count |

### Review Mode

Review Mode is the core study experience. It shows only cards that are **due for review** based on the spaced repetition algorithm. Every rating you make updates that card's schedule on this device and is written to a **local** review log; the server is not contacted during a study session.

**How to use:**

1. **Choose your direction** — tap the toggle at the top to study front→back or back→front
2. **Read the front** of the card
3. **Think of the back**
4. **Tap the card** (or tap anywhere on the card area) to flip it and reveal the back
5. **Rate yourself** using the four buttons at the bottom:

| Rating | Button | What it means |
|--------|--------|---------------|
| 1 | **Again** (red) | You forgot — card will be shown again soon |
| 2 | **Hard** (orange) | You struggled — interval increases slightly |
| 3 | **Good** (green) | You got it — normal interval progression |
| 4 | **Easy** (blue) | Too easy — interval increases significantly |

**Direction toggle:**

The toggle at the top switches between:

- **Front → Back** — see the front, recall the back (default)
- **Back → Front** — see the back, recall the front

The direction resets each time you start a new review session.

**Swipe gestures (mobile):**

| Gesture | Action |
|---------|--------|
| **Tap** | Flip card (reveal/hide answer) |
| **Swipe up** (on flipped card) | Same as "Good" (rate 3) |
| **Swipe down** (on flipped card) | Skip card (no rating, move to next) |

**During review:**

- A **progress bar** at the top shows your position (e.g., "3 / 15")
- The **Exit** button in the header (top-left) exits review early
- If a card has a `[SPEAK:]` tag in its notes, a purple **speaker button** appears at the bottom-left — tap it to hear the text spoken aloud

**When you finish all due cards:**

You see a **session summary** with:

- An encouraging message based on your accuracy
- Your accuracy percentage
- Number of cards reviewed and time spent
- A **Done** button to return to the Decks screen

**If there are no due cards:**

You'll see "All caught up!" with a button to go back.

### Learning Mode

Learning Mode lets you **browse all cards** in a deck freely, without any SRS ratings or scheduling. It's for studying new material or reviewing a deck at your own pace.

**How to use:**

1. Open a deck and tap the **Learn** button
2. **Choose your direction** — tap the toggle at the top to study front→back or back→front
3. Tap a card to **flip** it and reveal the other side
4. Navigate using the buttons at the bottom:

| Button | Action |
|--------|--------|
| **← Prev** | Previous card (wraps to end) |
| **Next →** | Next card (wraps to start) |

**Swipe gestures (mobile):**

| Gesture | Action |
|---------|--------|
| **Tap** | Flip card |
| **Swipe left** | Next card |
| **Swipe right** | Previous card |

**Key difference from Review Mode:**

- Shows **all** cards, not just due ones
- **No ratings** — your SRS state is not affected
- **No session logging** — nothing is recorded
- Cards **wrap around** (last → first, first → last)

### Progress Screen

Tap the **Progress** tab at the bottom to see global stats across all your local reviews:

| Stat | Meaning |
|------|---------|
| **Accuracy** | Percentage of reviews you rated "Good" or "Easy" (rating 3 or 4), from your local log |
| **Day Streak** | Consecutive days with at least one review |
| **Total Reviews** | Total number of reviews logged on this device |
| **Weak Cards** | Cards with a low ease factor (below 2.0), across your downloaded decks |
| **Decks** | Each downloaded deck: its due count and how many cards are mastered |

If you haven't downloaded any decks yet, the screen prompts you to download one (Decks → **⋮** → **Download**) to start tracking progress.

### Settings

In the **⋮** menu on the Decks screen, tap **Settings** to open the Settings modal.

| Field | What it does |
|-------|-------------|
| **Web App URL** | The GAS deployment URL |
| **User ID** | Your user ID |
| **Password** | Leave blank to keep current, or enter a new one |
| **Save** | Saves settings and updates your session |
| **Logout** | Clears your session and returns to the login screen |

---

## Using the CLI

The CLI tool (`flashy.js`) lets you manage decks and cards from the terminal. It communicates directly with the same GAS Web App backend.

### CLI Setup

**Requirements:** Node.js 18+ (no npm install needed — uses built-in `fetch` and `crypto`)

Check your version:

```bash
node --version   # Must be 18 or higher
```

**Configure the CLI:**

Create a `.flashyrc` file in the directory where you'll run commands:

```json
{
  "url": "https://script.google.com/macros/s/AKfycbx.../exec",
  "userid": "admin",
  "password": "yourPassword"
}
```

> **Security:** `.flashyrc` holds your password, so keep it out of version control. This project already lists it in `.gitignore`; because the file is plaintext, also restrict read access to it (for example, `chmod 600 .flashyrc`).

**Configuration priority:**

1. Command-line flags (`--url`, `--userid`, `--password`)
2. Environment variables (`FLASHY_URL`, `FLASHY_USERID`, `FLASHY_PASSWORD`)
3. `.flashyrc` file in the current working directory

### CLI Commands

#### Deck Commands

**List all decks:**

```bash
node flashy.js deck list
```

Output:

```
ID      │ Name                │ Cards │ Description
────────┼─────────────────────┼───────┼────────────
100000  │ Spanish Vocabulary  │    42 │ Learn Spanish
100001  │ Math Formulas       │    18 │ Key formulas
```

**Export a deck to a directory:**

```bash
node flashy.js deck export 100000
node flashy.js deck export 100000 my-spanish-vocab
```

Creates a directory containing `data.csv` and all card photos.

**Import a deck from a directory:**

```bash
node flashy.js deck import my-spanish-vocab
```

Creates a new deck from a directory of `data.csv` plus optional photos that are uploaded and attached. The new deck's name is taken from the directory name (for example, importing from `spanish-vocab/` creates a deck called `spanish-vocab`).

**Delete a deck:**

```bash
node flashy.js deck delete 100000
```

Soft-deletes the deck and all its cards.

#### Card Commands

**List cards in a deck:**

```bash
node flashy.js card list 100000
```

Output:

```
ID      │ Front                       │ Back            │ Photo
────────┼─────────────────────────────┼─────────────────┼──────
100000  │ What is 'hello' in Spanish? │ Hola            │ yes
100001  │ What is 'thank you'?        │ Gracias         │
```

**Import cards from a CSV file:**

```bash
node flashy.js card import 100000 new-cards.csv
```

Adds cards to an existing deck from a CSV file (text only, no photos).

### CLI Tips

**Create an alias** to avoid typing `node flashy.js` every time:

```bash
# Add to ~/.zshrc or ~/.bashrc
alias flashy="node /path/to/flashy/flashy.js"
```

Then use:

```bash
flashy deck list
```

---

## Data Format Reference

### CSV Format (for `card import` and `deck import`)

```csv
front,back,notes
"Hello","Hola","Common greeting"
"Goodbye","Adiós","Common greeting"
```

| Column | Required | Description |
|--------|----------|-------------|
| `front` | Yes | Front of the flashcard |
| `back` | Yes | Back of the flashcard |
| `notes` | No | Additional context or hints |

> The CLI also accepts legacy `question`/`answer` headers — they are mapped to `front`/`back` internally.

### Deck Directory Format (for `deck export` and `deck import`)

```
my-spanish-vocab/
├── data.csv          # Card data (required)
├── 100000.jpg        # Photos named by card ID
├── 100001.png
└── 100002.HEIC
```

**data.csv format:**

```csv
front,back,notes,photo
"Hello","Hola","Common greeting","100000.jpg"
"Goodbye","Adiós","",""
"Colors: red","Rojo","Color vocabulary","100002.HEIC"
```

| Column | Required | Description |
|--------|----------|-------------|
| `front` | Yes | Front of the flashcard |
| `back` | Yes | Back of the flashcard |
| `notes` | No | Additional context (empty string if none) |
| `photo` | No | Filename of an image in the same directory |

**Supported image formats:** JPG, JPEG, PNG, GIF, WebP, HEIC, HEIF, BMP, SVG

**Photo notes:**

- On export, photos are named by card ID + original extension (e.g., `100000.jpg`)
- On import, the CLI reads the file named in the `photo` column, uploads it, and attaches the URL
- Max file size: ~50MB (Google Apps Script limit)
- Photos are uploaded at their original size and quality; the app does not resize or recompress them.

### Notes Tags

The `notes` field supports special tags that affect card behavior. Tags are written as `[TAG_NAME:value]` at the start of a line.

#### Text-to-Speech Tag `[SPEAK:]`

Cards with a `[SPEAK:]` tag get a purple floating speaker button that reads the text aloud using the browser's Web Speech API.

**Syntax:**

```
[SPEAK:lang,rate,pitch]text to speak
```

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `lang` | string | BCP-47 language code | `ko-KR`, `en-US`, `ja-JP` |
| `rate` | number | Speech speed (0.1–10) | `1` = normal, `0.5` = slow |
| `pitch` | number | Voice pitch (0–2) | `1` = normal, `1.5` = higher |
| `text` | string | Text to speak | `안녕하세요` |

**Example:**

```csv
front,back,notes
"안녕하세요","Hello","[SPEAK:ko-KR,1,1]안녕하세요\nKorean greeting\nFormal"
```

**Key points:**

- The `[SPEAK:]` line is hidden from the card display — only non-tag lines are shown
- The speaker button appears on both the front and back of the card
- Direction (front→back vs back→front) is controlled by the study mode toggle

### When to Use Each Import Command

| Use case | Command |
|----------|---------|
| Add cards to an existing deck | `card import` |
| Create a new deck from a directory | `deck import` |
| Import cards with photos | `deck import` (with directory) |
| Import plain text cards from CSV | `card import` |

---

## Spaced Repetition Explained

Flashy uses a variant of the **SM-2 algorithm** (the same algorithm used by Anki). Here's how it works:

### How Cards Are Scheduled

Each card tracks:
- **Ease Factor** (starts at 2.5) — how "easy" the card is for you
- **Interval** (days) — how long until the next review
- **Due Date** — when the card next needs review
- **Review Count** — how many times you've reviewed it

When you rate a card:

| Rating | Effect |
|--------|--------|
| **Again** (1) | Interval resets to 1 day, ease factor decreases by 0.2 |
| **Hard** (2) | Interval multiplied by 1.2, ease factor decreases by 0.15 |
| **Good** (3) | First review: 1 day. Second review: 6 days. After that: interval × ease factor |
| **Easy** (4) | First review: 4 days. After that: interval × ease factor × 1.3, ease factor increases by 0.15 |

The ease factor has a minimum of 1.3 (cards can never become impossibly hard to schedule).

### What "Due Today" Means

A card is due when its due date is today or earlier. New cards (never reviewed) are always due. The more often you rate "Good" or "Easy", the longer the intervals become — so you see easy cards less often.

### What "Mastered" Means

A card is considered mastered when its interval reaches 21 days or more. This means you've demonstrated you can remember it for at least 3 weeks.

---

## Troubleshooting

### Web App

| Problem | Solution |
|---------|----------|
| "Network error — check URL" | Make sure the GAS Web App URL is correct and deployed. If accessing via `http://` on LAN, the app has a built-in SHA-256 fallback that should work. |
| "Unauthorized" on login | Check that your password matches the plaintext value in the Users sheet and your status is `Active`. |
| Blank screen after login | Open the browser console (Safari: Develop > Show Web Inspector) and check for errors. |
| Photos not loading | Verify the Google Drive folder `Flashy/Photos` exists and the files are shared with "Anyone with the link." |
| "Script not authorized" | Re-deploy the GAS: Deploy > Manage deployments > Edit > New version > Deploy. |
| POST returns empty | The GAS CORS workaround requires `Content-Type: text/plain` — this is handled automatically. |
| Swipe not working | Ensure the swipe distance is at least 50px. The app distinguishes taps from swipes. |

### CLI

| Problem | Solution |
|---------|----------|
| "Missing URL" error | Make sure `.flashyrc` exists in the directory where you're running the command, or pass `--url`. |
| "Invalid credentials" | Your password doesn't match the Users sheet. The CLI hashes with SHA-256 before sending. |
| "Deck not found" | Run `deck list` to see available IDs. Deck IDs are 6-digit numbers (e.g., `100000`). |
| "data.csv not found" | You're importing a directory that doesn't contain `data.csv`. |
| CSV parsing errors | The header row must include `front` and `back` (or the legacy aliases `question`/`answer`); `notes` and `photo` are optional. Quote any values that contain commas. |
| "fetch is not defined" | You need Node.js 18 or higher. |
| Photo upload fails | Check the file exists, is a supported format, and is under 50MB. |
| Permission denied on `.flashyrc` | Run `chmod 600 .flashyrc` to restrict to your user only. |

---

## Quick Reference

### Keyboard / Gesture Cheat Sheet

**Review Mode:**

| Input | Action |
|-------|--------|
| Tap card | Flip card |
| Swipe up (flipped) | Rate "Good" |
| Swipe down (flipped) | Skip card |
| Tap Again/Hard/Good/Easy | Rate and advance |
| Tap direction toggle | Switch front→back / back→front |
| Tap speaker button | Read card text aloud (if [SPEAK:] tag present) |

**Learning Mode:**

| Input | Action |
|-------|--------|
| Tap card | Flip card |
| Swipe left | Next card |
| Swipe right | Previous card |
| Tap ← Prev / Next → | Navigate |
| Tap direction toggle | Switch front→back / back→front |

### File Overview

| File | Purpose |
|------|---------|
| `index.html` | Web app HTML shell |
| `app.js` | Web app React SPA |
| `code.gs` | Google Apps Script backend |
| `flashy.js` | CLI tool |
| `.flashyrc` | CLI config (not in git) |
| `SETUP.md` | Deployment guide |
| `USER_MANUAL.md` | This file |
