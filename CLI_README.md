# Flashy CLI

A command-line tool for managing Flashy flashcard decks and cards. Talks directly to your Google Apps Script backend — no separate server needed.

## Requirements

- **Node.js 18+** (uses built-in `fetch` and `crypto` — no npm install needed)
- A deployed Flashy GAS Web App (see `SETUP.md`)
- A valid Flashy user account (any role in the Users sheet)

Check your Node version:

```bash
node --version   # Must be 18 or higher
```

## Quick Start

### 1. Configure

Create a `.flashyrc` file in the directory where you'll run commands:

```bash
cd <path-to-flashy>
```

Create `.flashyrc` with your GAS deployment URL and password:

```json
{
  "url": "https://script.google.com/macros/s/AKfycbx.../exec",
  "userid": "admin",
  "password": "yourActualPassword"
}
```

> **Security tip:** `.flashyrc` is already in `.gitignore` — it contains your password and will not be committed.

### 2. Run

```bash
node flashy.js deck list
```

You should see a table of your decks. If you see `Error: Missing URL`, the config file isn't being found — see [Configuration](#configuration) below.

## Configuration

The CLI looks for `.flashyrc` in the **current working directory** (where you run the command from).

### Option A: Config file (recommended)

Create `.flashyrc` in your current working directory:

```bash
# Edit .flashyrc with your URL and password
```

### Option B: Environment variables

```bash
export FLASHY_URL="https://script.google.com/macros/s/.../exec"
export FLASHY_USERID="admin"
export FLASHY_PASSWORD="yourPassword"
```

Add these to your `~/.zshrc` or `~/.bashrc` to persist across sessions.

### Option C: Command-line flags

```bash
node flashy.js deck list --url "https://script.google.com/macros/s/.../exec" --password "yourPassword"
```

### Option D: Global install

To avoid typing `node flashy.js` every time, create an alias:

```bash
# Add to ~/.zshrc or ~/.bashrc (replace with your actual path)
alias flashy="node /path/to/flashy/flashy.js"
```

Then use:

```bash
flashy deck list
```

### Priority order

1. Command-line flags (`--url`, `--password`)
2. Environment variables (`FLASHY_URL`, `FLASHY_PASSWORD`)
3. `.flashyrc` file in current working directory

---

## Commands

### Deck Commands

#### `deck list` — List all decks

```bash
node flashy.js deck list
```

**Output:**

```
ID      │ Name                │ Cards │ Description
────────┼─────────────────────┼───────┼────────────
100000  │ Spanish Vocabulary  │    42 │ Learn Spanish
100001  │ Math Formulas       │    18 │ Key formulas
100002  │ History Dates       │     0 │
```

Shows each deck's ID, name, card count, and description. Only active (non-deleted) decks are shown.

---

#### `deck export <deckId> [directory]` — Export a deck

```bash
node flashy.js deck export 100000
node flashy.js deck export 100000 my-spanish-vocab
```

**What it does:**

1. Fetches all active cards from the deck
2. Creates a directory (named after the deck if no directory specified)
3. Writes `data.csv` with all card data
4. Downloads all card photos from Google Drive and saves them in the directory

**Output:**

```
Exported deck "Spanish Vocabulary" to my-spanish-vocab/
  42 cards, 12 photos
```

**Directory structure created:**

```
my-spanish-vocab/
├── data.csv          # Card data (front, back, notes, photo)
├── 100000.jpg        # Photos named by card ID
├── 100001.png
├── 100002.HEIC
└── ...
```

**data.csv format:**

```csv
front,back,notes,photo
"What is 'hello' in Spanish?","Hola","Common greeting","100000.jpg"
"What is 'thank you'?","Gracias","",""
"Colors: red","Rojo","Color vocabulary","100002.HEIC"
"What is 'blue'?","Azul","","100003.png"
```

**Column reference:**

| Column | Required | Description |
|--------|----------|-------------|
| `front` | Yes | Front of the flashcard |
| `back` | Yes | Back of the flashcard |
| `notes` | No | Additional context or hints |
| `photo` | No | Filename of image in the same directory |

**Notes:**

- Card IDs are NOT exported (new IDs assigned on import)
- Photo filenames are the card's ID + original extension
- Photos with download errors are skipped with a warning
- The directory name defaults to the deck name, slugified (e.g., "Spanish Vocabulary" → `spanish-vocabulary`)

---

#### `deck import <directory>` — Import a deck

```bash
node flashy.js deck import my-spanish-vocab
```

**What it does:**

1. Reads `data.csv` from the directory
2. Creates a new deck (named after the directory)
3. For each card row:
   - If a `photo` filename is specified, reads the file, uploads it via the GAS API, and attaches the returned URL
   - Creates the card with front, back, notes, and photo URL

**Output:**

```
Creating deck "my-spanish-vocab"...
Created deck 100003
  Imported 42 cards...
Imported 42 cards into deck 100003 (12 photos, 0 skipped)
```

**Requirements:**

- Directory must contain `data.csv`
- `data.csv` must have `front` and `back` columns (also accepts legacy `question`/`answer`)
- Photo files referenced in the `photo` column must exist in the same directory

**Supported image formats for upload:**

JPG, JPEG, PNG, GIF, WebP, HEIC, HEIF, BMP, SVG

### Notes Tags

The `notes` field supports special tags that affect card behavior in the web app. Tags are written as `[TAG_NAME:value]` at the start of a line.

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

**CSV example with TTS:**

```csv
front,back,notes
"안녕하세요","Hello","[SPEAK:ko-KR,1,1]안녕하세요\nKorean greeting\nFormal"
"감사합니다","Thank you","[SPEAK:ko-KR,0.9,1]감사합니다\nPolite expression"
```

**Key points:**

- The `[SPEAK:]` line is hidden from the card display — only non-tag lines are shown
- The speaker button appears on both the front and back of the card
- Direction (front→back vs back→front) is controlled by the study mode toggle in the web app

**Example workflow — backup and restore:**

```bash
# Export
node flashy.js deck export 100000

# Later, import to a new account
node flashy.js deck import spanish-vocabulary
```

---

#### `deck delete <deckId>` — Delete a deck

```bash
node flashy.js deck delete 100000
```

**What it does:**

Soft-deletes the deck and all its cards. The deck and cards are marked as `Inactive` in the spreadsheet — they are not permanently removed.

**Output:**

```
Deleted deck 100000
```

---

---

### Card Commands

#### `card list <deckId>` — List cards in a deck

```bash
node flashy.js card list 100000
```

**Output:**

```
ID      │ Front                                     │ Back            │ Photo
────────┼───────────────────────────────────────────┼─────────────────┼──────
100000  │ What is 'hello' in Spanish?               │ Hola            │ yes
100001  │ What is 'thank you' in Spanish?           │ Gracias         │
100002  │ What is 'goodbye' in Spanish?             │ Adiós           │ yes
```

Fronts and backs longer than 40/30 characters are truncated with `...`.

---

#### `card import <deckId> <file.csv>` — Import cards from CSV

```bash
node flashy.js card import 100000 new-cards.csv
```

**What it does:**

Reads the CSV file and creates each card in the specified deck. This is a simple import — no photos.

**Output:**

```
  Imported 25/30 cards...
Imported 25 cards (5 skipped)
```

**CSV format:**

```csv
front,back,notes
"Hello","Hola","Common greeting"
"Goodbye","Adiós","Common greeting"
"What is 'cat'?","Gato","Animal vocabulary"
```

**Requirements:**

- Must have `front` and `back` columns (also accepts legacy `question`/`answer` headers)
- `notes` column is optional
- Empty rows or rows with missing front/back are skipped

**When to use `card import` vs `deck import`:**

| Use case | Command |
|----------|---------|
| Add cards to an existing deck | `card import` |
| Create a new deck from a directory | `deck import` |
| Import cards with photos | `deck import` (with directory) |
| Import plain text cards from CSV | `card import` |

---

## Global Options

All commands accept these flags to override config:

| Flag | Env Var | Description |
|------|---------|-------------|
| `--url <url>` | `FLASHY_URL` | GAS Web App URL |
| `--userid <id>` | `FLASHY_USERID` | User ID |
| `--password <pw>` | `FLASHY_PASSWORD` | Password |

**Examples:**

```bash
# Override password for one command
node flashy.js deck list --password "differentPassword"

# Use env vars
FLASHY_URL="https://..." FLASHY_PASSWORD="secret" node flashy.js deck list
```

---

## Deck Directory Format

This is the standard format for deck export/import. Each deck is a self-contained directory.

### Structure

```
deck-name/
├── data.csv          # Card data (required)
├── photo1.jpg        # Image files (optional)
├── photo2.png
└── photo3.HEIC
```

### data.csv Specification

```csv
front,back,notes,photo
"Hello","Hola","Common greeting","photo1.jpg"
"Goodbye","Adiós","",""
"Colors: red","Rojo","Color vocabulary","photo2.png"
```

**Rules:**

- First row must be the header: `front,back,notes,photo` (also accepts `question,answer,notes,photo`)
- `front` and `back` are required
- `notes` is optional (empty string if not needed)
- `photo` is optional — contains the filename of an image in the same directory
- Values containing commas, quotes, or newlines must be quoted
- Double quotes inside quoted values are escaped as `""`

### Photo Handling

**Export:** Photos are downloaded from Google Drive and saved as `<cardId>.<extension>` (e.g., `100000.jpg`).

**Import:** The CLI reads the file named in the `photo` column, uploads it via the GAS API, and attaches the returned URL to the card.

**Supported formats:** JPG, JPEG, PNG, GIF, WebP, HEIC, HEIF, BMP, SVG

**Limitations:**

- Max file size: ~50MB (GAS limit)
- HEIC files are uploaded as-is; some browsers may not display them in the web app
- Photos are optional — cards without photos work fine

---

## Typical Workflows

### Backup all decks

```bash
# List decks to get IDs
node flashy.js deck list

# Export each deck
node flashy.js deck export 100000 spanish-vocab
node flashy.js deck export 100001 math-formulas
node flashy.js deck export 100002 history-dates
```

### Restore from backup

```bash
node flashy.js deck import spanish-vocab
node flashy.js deck import math-formulas
node flashy.js deck import history-dates
```

### Share a deck with someone

```bash
# Export
node flashy.js deck export 100000 shared-deck

# Zip and send
zip -r shared-deck.zip shared-deck/

# They import
node flashy.js deck import shared-deck
```

### Bulk add cards from spreadsheet

1. Export your spreadsheet to CSV with columns `front,back,notes`
2. Save as `new-cards.csv`
3. Import:

```bash
node flashy.js card import 100000 new-cards.csv
```

### Migrate decks between accounts

1. Export from old account
2. Change `.flashyrc` to new account URL/password
3. Import to new account

---

## Troubleshooting

### "Missing URL" error

The CLI can't find `.flashyrc` in the current directory.

**Fix:** Make sure you're running the command from the directory containing `.flashyrc`:

```bash
cd /path/to/flashy
node flashy.js deck list
```

Or pass the URL directly:

```bash
node flashy.js deck list --url "https://script.google.com/macros/s/.../exec" --password "yourPassword"
```

### "Invalid credentials" error

Your password doesn't match what's in the Google Sheet.

**Fix:** Check the Users sheet in your spreadsheet. The `password` column must contain the plaintext password. The CLI hashes it with SHA-256 before sending.

### "Unauthorized" error

Same as above — the password hash didn't match any active user.

**Check:** Make sure your user's status is "Active" in the Users sheet.

### "Deck not found" error

The deck ID doesn't exist or is soft-deleted.

**Fix:** Run `deck list` to see available deck IDs. Deck IDs are 6-digit zero-padded numbers (e.g., `100000`, `100001`).

### Photo upload fails

- **File not found:** Check the filename in the `photo` column matches a file in the directory
- **Unsupported format:** Use JPG, PNG, GIF, WebP, or BMP
- **File too large:** Keep images under 50MB
- **GAS timeout:** Large images may take time to upload; the CLI will show a warning

### "data.csv not found" error

You're trying to import a directory that doesn't contain `data.csv`.

**Fix:** Make sure the directory has a `data.csv` file with the correct format.

### CSV parsing errors

- Make sure the first row is the header: `front,back,notes,photo`
- Quote values that contain commas: `"hello, world","hi"`
- Escape quotes inside quoted values: `"say ""hello""","hi"`

### Node.js version error

```
Error: fetch is not defined
```

You need Node.js 18 or higher. Check with `node --version`.

### Permission denied on .flashyrc

```bash
chmod 600 .flashyrc
```

This restricts the file to your user only (recommended for files with passwords).

---

## API Reference

The CLI communicates with your GAS Web App using these endpoints:

### GET Endpoints

| Endpoint | Parameters | Description |
|----------|------------|-------------|
| `login` | `pwHash` | Authenticate (returns user info) |
| `getDecks` | `pwHash` | List all active decks with card counts |
| `getCards` | `deckId`, `pwHash` | List all active cards in a deck |
| `searchCards` | `query`, `deckId` (optional), `pwHash` | Search cards by text |

### POST Endpoints

| Endpoint | Body Fields | Description |
|----------|-------------|-------------|
| `createDeck` | `name`, `description` | Create a new deck (creates sheet tab) |
| `updateDeck` | `id`, `name`, `description` | Update deck metadata |
| `deleteDeck` | `id` | Soft-delete deck and all its cards |
| `createCard` | `deckId`, `front`, `back`, `notes`, `photoUrl` | Create a card |
| `updateCard` | `deckId`, `id`, `front`, `back`, `notes`, `photoUrl` | Update a card |
| `deleteCard` | `deckId`, `id` | Soft-delete a card |
| `uploadPhoto` | `photoData` (data URL), `photoName` | Upload photo, returns `photoUrl` |

All requests require `pwHash` (SHA-256 of password) for authentication.

---

## File Reference

| File | Purpose |
|------|---------|
| `flashy.js` | CLI implementation |
| `CLI_README.md` | This file — usage documentation |
| `CLI_DESIGN.md` | Design document |
| `app.js` | Web app frontend (single-file React SPA) |
| `index.html` | Web app HTML shell (React 18, Tailwind, Babel via CDN) |
| `code.gs` | GAS backend (deployed separately) |
| `.flashyrc` | Your config (create manually, not in git) |
| `SETUP.md` | GAS deployment guide |
| `IMPLEMENTATION_PLAN.md` | Architecture and schema |
| `LEARNING_MODE_SPEC.md` | Learning mode feature spec |
