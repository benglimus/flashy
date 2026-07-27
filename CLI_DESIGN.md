# Flashy CLI — Design Document

## Overview

A single-file Node.js CLI (`flashy.js`) for managing Flashy decks, cards, and users
from the terminal. Communicates with the Google Sheets backend via the existing
GAS Web App API.

## Setup

### Prerequisites
- Node.js 18+ (uses built-in `fetch` and `crypto`)
- GAS Web App URL
- A Flashy user account (any role)

### Configuration
Create `.flashyrc` in your current working directory:
```json
{
  "url": "https://script.google.com/macros/s/AKfycbx.../exec",
  "userid": "admin",
  "password": "yourPassword"
}
```

Override with flags: `--url`, `--userid`, `--password`
Or env vars: `FLASHY_URL`, `FLASHY_USERID`, `FLASHY_PASSWORD`

## Commands

### Deck Management

| Command | Description |
|---------|-------------|
| `node flashy.js deck list` | List all decks with card count |
| `node flashy.js deck export <deckId> [dir]` | Export deck to directory |
| `node flashy.js deck import <dir>` | Import deck from directory |
| `node flashy.js deck delete <deckId>` | Soft-delete a deck and all its cards |

### Card Management

| Command | Description |
|---------|-------------|
| `node flashy.js card list <deckId>` | List all cards in a deck |
| `node flashy.js card import <deckId> <file.csv>` | Bulk import from CSV |

## Directory Format

Each deck export is a self-contained directory:

```
spanish-vocabulary/
├── data.csv
├── IMG_0042.HEIC
└── screenshot.png
```

## CSV Format (data.csv)

Columns: front, back, notes, photo

```csv
front,back,notes,photo
"Hello","Hola","Common greeting","IMG_0042.HEIC"
"Goodbye","Adiós","",""
```

- front, back: required (also accepts legacy `question`, `answer` headers)
- notes: optional (empty string if none); supports `[SPEAK:lang,rate,pitch]text` tags for TTS
- photo: filename of image in same directory (empty string if none)

## Export Flow

1. GET getDecks → find deck by ID
2. GET getCards → get all active cards
3. Create directory (slugified deck name)
4. Write data.csv
5. For each card with photoUrl:
   - Extract Google Drive file ID
   - Download via lh3.googleusercontent.com
   - Save as <cardId>.<ext>

## Import Flow (directory)

1. Parse data.csv
2. POST createDeck → get new deck ID
3. For each row:
   - If photo present: read file, base64, POST uploadPhoto → photoUrl
   - POST createCard

## Import Flow (standalone CSV)

1. Parse CSV file
2. POST createCard for each row (no photos)

## API Endpoints Used

All existing — no new GAS endpoints needed:
- getDecks, getCards, createDeck, createCard, uploadPhoto

## Tech Stack

- Node.js 18+ (no npm dependencies)
- Single file: flashy.js
- Built-in: fetch, crypto (SHA-256), fs, path

## Project Files

| File | Purpose |
|------|---------|
| `flashy.js` | CLI implementation |
| `app.js` | Web app frontend (single-file React SPA) |
| `index.html` | Web app HTML shell (React 18, Tailwind, Babel via CDN) |
| `code.gs` | GAS backend (deployed separately) |
| `CLI_README.md` | CLI usage documentation |
| `CLI_DESIGN.md` | This file — design document |
| `SETUP.md` | GAS deployment guide |
| `IMPLEMENTATION_PLAN.md` | Architecture and schema |
| `LEARNING_MODE_SPEC.md` | Learning mode feature spec |
