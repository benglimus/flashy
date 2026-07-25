#!/usr/bin/env node

// Flashy CLI — Manage decks, cards, and users from the terminal
// Requires Node.js 18+ (built-in fetch, crypto)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Config ───

const CONFIG_PATH = path.join(process.cwd(), '.flashyrc');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function getConfig() {
  const file = loadConfig();
  return {
    url: process.env.FLASHY_URL || file.url || '',
    userid: process.env.FLASHY_USERID || file.userid || '',
    password: process.env.FLASHY_PASSWORD || file.password || '',
  };
}

// ─── Auth ───

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ─── API ───

async function apiGet(cfg, endpoint, params = {}) {
  const url = new URL(cfg.url);
  url.searchParams.set('endpoint', endpoint);
  url.searchParams.set('pwHash', sha256(cfg.password));
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiPost(cfg, data) {
  data.pwHash = sha256(cfg.password);
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Helpers ───

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function toCSVLine(fields) {
  return fields.map(f => {
    const s = String(f);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',');
}

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
  if (lines.length < 1) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(parseCSVLine(lines[i]));
  }
  return { headers, rows };
}

function getFileExtension(url) {
  const match = url.match(/\/([^/?#]+)(\?|$)/);
  if (match) {
    const name = match[1];
    const dotIdx = name.lastIndexOf('.');
    if (dotIdx >= 0) return name.slice(dotIdx);
  }
  return '.jpg';
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.heic': 'image/heic',
    '.heif': 'image/heif', '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

function formatTable(headers, rows) {
  const widths = headers.map((h, i) => {
    const colWidths = rows.map(r => String(r[i] || '').length);
    return Math.max(h.length, ...colWidths);
  });
  const sep = widths.map(w => '─'.repeat(w + 2)).join('┼');
  const headerLine = headers.map((h, i) => ' ' + h.padEnd(widths[i]) + ' ').join('│');
  const dataLines = rows.map(r =>
    r.map((c, i) => ' ' + String(c || '').padEnd(widths[i]) + ' ').join('│')
  );
  return [headerLine, sep, ...dataLines].join('\n');
}

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(msg);
}

// ─── Commands ───

async function cmdDeckList(cfg) {
  const res = await apiGet(cfg, 'getDecks');
  if (res.status === 'error') die(res.message);
  if (res.decks.length === 0) {
    log('No decks found.');
    return;
  }
  const headers = ['ID', 'Name', 'Cards', 'Description'];
  const rows = res.decks.map(d => [d.id, d.name, d.cardCount, d.description || '']);
  log(formatTable(headers, rows));
}

async function cmdDeckExport(cfg, deckId, outputDir) {
  // 1. Get deck metadata
  const decksRes = await apiGet(cfg, 'getDecks');
  if (decksRes.status === 'error') die(decksRes.message);
  const deck = decksRes.decks.find(d => d.id === deckId);
  if (!deck) die(`Deck ${deckId} not found`);

  // 2. Get all cards
  const cardsRes = await apiGet(cfg, 'getCards', { deckId });
  if (cardsRes.status === 'error') die(cardsRes.message);

  // 3. Create output directory
  const dir = outputDir || slugify(deck.name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 4. Write data.csv and download photos
  const csvLines = ['question,answer,notes,photo'];
  let photoCount = 0;

  for (const card of cardsRes.cards) {
    let photoFilename = '';
    if (card.photoUrl) {
      try {
        // Extract file ID from Google Drive URL
        const fileIdMatch = card.photoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[1];
          const directUrl = `https://lh3.googleusercontent.com/d/${fileId}?authuser=0`;
          const ext = getFileExtension(card.photoUrl);
          photoFilename = `${card.id}${ext}`;
          await downloadImage(directUrl, path.join(dir, photoFilename));
          photoCount++;
        }
      } catch (err) {
        console.error(`  Warning: Failed to download photo for card ${card.id}: ${err.message}`);
      }
    }
    csvLines.push(toCSVLine([card.question, card.answer, card.notes || '', photoFilename]));
  }

  fs.writeFileSync(path.join(dir, 'data.csv'), csvLines.join('\n') + '\n');

  log(`Exported deck "${deck.name}" to ${dir}/`);
  log(`  ${cardsRes.cards.length} cards, ${photoCount} photos`);
}

async function cmdDeckImport(cfg, inputDir) {
  // 1. Read data.csv
  const csvPath = path.join(inputDir, 'data.csv');
  if (!fs.existsSync(csvPath)) die(`data.csv not found in ${inputDir}`);

  const { headers, rows } = parseCSV(fs.readFileSync(csvPath, 'utf-8'));
  const qIdx = headers.indexOf('question');
  const aIdx = headers.indexOf('answer');
  const nIdx = headers.indexOf('notes');
  const pIdx = headers.indexOf('photo');

  if (qIdx === -1 || aIdx === -1) die('data.csv must have "question" and "answer" columns');

  // 2. Derive deck name from directory
  const deckName = path.basename(path.resolve(inputDir));

  // 3. Create deck
  log(`Creating deck "${deckName}"...`);
  const deckRes = await apiPost(cfg, {
    endpoint: 'createDeck',
    name: deckName,
    description: '',
  });
  if (deckRes.status === 'error') die(deckRes.message);
  const deckId = deckRes.id;
  log(`Created deck ${deckId}`);

  // 4. Import cards
  let imported = 0;
  let photoCount = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const question = (row[qIdx] || '').trim();
    const answer = (row[aIdx] || '').trim();
    const notes = nIdx !== -1 ? (row[nIdx] || '').trim() : '';
    const photo = pIdx !== -1 ? (row[pIdx] || '').trim() : '';

    if (!question || !answer) {
      skipped++;
      continue;
    }

    let photoUrl = '';
    if (photo) {
      const photoPath = path.join(inputDir, photo);
      if (fs.existsSync(photoPath)) {
        try {
          const mime = getMimeType(photoPath);
          const base64 = fs.readFileSync(photoPath).toString('base64');
          const dataUrl = `data:${mime};base64,${base64}`;
          const uploadRes = await apiPost(cfg, {
            endpoint: 'uploadPhoto',
            photoData: dataUrl,
            photoName: photo,
          });
          if (uploadRes.status === 'ok') {
            photoUrl = uploadRes.photoUrl;
            photoCount++;
          } else {
            console.error(`  Warning: Failed to upload ${photo}: ${uploadRes.message}`);
          }
        } catch (err) {
          console.error(`  Warning: Failed to upload ${photo}: ${err.message}`);
        }
      } else {
        console.error(`  Warning: Photo file not found: ${photoPath}`);
      }
    }

    const cardRes = await apiPost(cfg, {
      endpoint: 'createCard',
      deckId,
      question,
      answer,
      notes,
      photoUrl,
    });
    if (cardRes.status === 'error') {
      console.error(`  Warning: Failed to create card: ${cardRes.message}`);
      skipped++;
    } else {
      imported++;
      process.stdout.write(`\r  Imported ${imported}/${rows.length} cards...`);
    }
  }

  console.log('');
  log(`Imported ${imported} cards into deck ${deckId} (${photoCount} photos, ${skipped} skipped)`);
}

async function cmdCardList(cfg, deckId) {
  const res = await apiGet(cfg, 'getCards', { deckId });
  if (res.status === 'error') die(res.message);
  if (res.cards.length === 0) {
    log('No cards found.');
    return;
  }
  const headers = ['ID', 'Question', 'Answer', 'Photo'];
  const rows = res.cards.map(c => [
    c.id,
    c.question.length > 40 ? c.question.slice(0, 37) + '...' : c.question,
    c.answer.length > 30 ? c.answer.slice(0, 27) + '...' : c.answer,
    c.photoUrl ? 'yes' : '',
  ]);
  log(formatTable(headers, rows));
}

async function cmdCardImport(cfg, deckId, csvFile) {
  if (!fs.existsSync(csvFile)) die(`File not found: ${csvFile}`);

  const { headers, rows } = parseCSV(fs.readFileSync(csvFile, 'utf-8'));
  const qIdx = headers.indexOf('question');
  const aIdx = headers.indexOf('answer');
  const nIdx = headers.indexOf('notes');

  if (qIdx === -1 || aIdx === -1) die('CSV must have "question" and "answer" columns');

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const question = (row[qIdx] || '').trim();
    const answer = (row[aIdx] || '').trim();
    const notes = nIdx !== -1 ? (row[nIdx] || '').trim() : '';

    if (!question || !answer) {
      skipped++;
      continue;
    }

    const res = await apiPost(cfg, {
      endpoint: 'createCard',
      deckId,
      question,
      answer,
      notes,
    });
    if (res.status === 'error') {
      console.error(`  Warning: Failed to create card: ${res.message}`);
      skipped++;
    } else {
      imported++;
      process.stdout.write(`\r  Imported ${imported}/${rows.length} cards...`);
    }
  }

  console.log('');
  log(`Imported ${imported} cards (${skipped} skipped)`);
}

async function cmdDeckDelete(cfg, deckId) {
  const res = await apiPost(cfg, { endpoint: 'deleteDeck', id: deckId });
  if (res.status === 'error') die(res.message);
  log(`Deleted deck ${deckId}`);
}

// ─── CLI Parser ───

function printUsage() {
  log(`
Flashy CLI — Manage your flashcard decks from the terminal

Usage:
  node flashy.js <command> [args]

Deck Commands:
  deck list                       List all decks
  deck export <deckId> [dir]      Export deck to directory
  deck import <dir>               Import deck from directory
  deck delete <deckId>            Delete a deck

Card Commands:
  card list <deckId>              List cards in a deck
  card import <deckId> <file>     Import cards from CSV file

Global Options:
  --url <url>         GAS Web App URL
  --userid <id>       User ID
  --password <pw>     Password

Config:
  Create ~/.flashyrc with {"url":"...","userid":"...","password":"..."}
  Or set FLASHY_URL, FLASHY_USERID, FLASHY_PASSWORD env vars

Examples:
  node flashy.js deck list
  node flashy.js deck export 100000 my-spanish-vocab
  node flashy.js deck import my-spanish-vocab
  node flashy.js card list 100000
  node flashy.js card import 100000 cards.csv
`);
}

async function main() {
  const args = process.argv.slice(2);

  // Parse global flags
  const cfg = getConfig();
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) { cfg.url = args[++i]; }
    else if (args[i] === '--userid' && args[i + 1]) { cfg.userid = args[++i]; }
    else if (args[i] === '--password' && args[i + 1]) { cfg.password = args[++i]; }
    else { positional.push(args[i]); }
  }

  if (positional.length === 0 || positional[0] === '--help' || positional[0] === '-h') {
    printUsage();
    return;
  }

  if (!cfg.url) die('Missing URL. Set --url, FLASHY_URL, or add "url" to ~/.flashyrc');
  if (!cfg.password) die('Missing password. Set --password, FLASHY_PASSWORD, or add "password" to ~/.flashyrc');

  const [group, command, ...rest] = positional;

  try {
    if (group === 'deck') {
      if (command === 'list') await cmdDeckList(cfg);
      else if (command === 'export') {
        if (rest.length < 1) die('Usage: deck export <deckId> [directory]');
        await cmdDeckExport(cfg, rest[0], rest[1]);
      }
      else if (command === 'import') {
        if (rest.length < 1) die('Usage: deck import <directory>');
        await cmdDeckImport(cfg, rest[0]);
      }
      else if (command === 'delete') {
        if (rest.length < 1) die('Usage: deck delete <deckId>');
        await cmdDeckDelete(cfg, rest[0]);
      }
      else die(`Unknown deck command: ${command}`);
    } else if (group === 'card') {
      if (command === 'list') {
        if (rest.length < 1) die('Usage: card list <deckId>');
        await cmdCardList(cfg, rest[0]);
      } else if (command === 'import') {
        if (rest.length < 2) die('Usage: card import <deckId> <file.csv>');
        await cmdCardImport(cfg, rest[0], rest[1]);
      }
      else die(`Unknown card command: ${command}`);
    } else {
      die(`Unknown command group: ${group}`);
    }
  } catch (err) {
    die(err.message);
  }
}

main();
