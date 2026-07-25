// Flashy — Google Apps Script Backend

// ─── Utilities ───

function getConfig(key) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Config");
  if (!sheet) return "";
  const rows = sheet.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) return rows[i][1];
  }
  return "";
}

function setConfig(key, value) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Config");
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function sha256(text) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateUuid() {
  return Utilities.getUuid();
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function nowIso() {
  return new Date().toISOString();
}

function createJsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function getNextId(configKey) {
  const configSheet = SpreadsheetApp.getActive().getSheetByName("Config");
  if (!configSheet) return '100000';
  const rows = configSheet.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === configKey) {
      const next = parseInt(rows[i][1]) || 100000;
      configSheet.getRange(i + 1, 2).setValue(next + 1);
      return String(next).padStart(6, '0');
    }
  }
  configSheet.appendRow([configKey, 100001]);
  return '100000';
}

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getValues();
}

function findRow(sheetName, columnIndex, value) {
  const rows = getSheetData(sheetName);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][columnIndex]) === String(value)) {
      return { row: i, data: rows[i] };
    }
  }
  return null;
}

// ─── Auth ───

function verifyAuth(e, data) {
  const pwHash = (e && e.parameter && e.parameter.pwHash) || (data && data.pwHash);
  if (!pwHash) return false;
  const rows = getSheetData("Users");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][3] !== 'Active') continue;
    if (sha256(rows[i][1]) === pwHash) return true;
  }
  return false;
}

function getUserIdFromHash(pwHash) {
  const rows = getSheetData("Users");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][3] !== 'Active') continue;
    if (sha256(rows[i][1]) === pwHash) return rows[i][0];
  }
  return null;
}

function handleLogin(data) {
  const pwHash = data.pwHash;
  if (!pwHash) return createJsonResponse({ status: "error", message: "Missing password" });
  const rows = getSheetData("Users");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][3] !== 'Active') continue;
    if (sha256(rows[i][1]) === pwHash) {
      return createJsonResponse({ status: "ok", user: { userid: rows[i][0], name: rows[i][2] } });
    }
  }
  return createJsonResponse({ status: "error", message: "Invalid credentials" });
}

// ─── Deck Sheet Helpers ───

function getDeckSheetName(deckId) {
  return 'Deck_' + deckId;
}

function getDeckSheet(deckId) {
  return SpreadsheetApp.getActive().getSheetByName(getDeckSheetName(deckId));
}

function getAllDeckIds() {
  const rows = getSheetData("Decks");
  const ids = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][5] !== 'Active') continue;
    ids.push(String(rows[i][0]));
  }
  return ids;
}

// ─── Deck Handlers ───

function handleGetDecks() {
  const rows = getSheetData("Decks");
  const decks = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][5] !== 'Active') continue;
    const deckId = String(rows[i][0]);
    const deckSheet = getDeckSheet(deckId);
    const cardCount = deckSheet ? Math.max(0, deckSheet.getLastRow() - 1) : 0;
    decks.push({
      id: deckId,
      name: rows[i][1],
      description: rows[i][2],
      created: rows[i][3],
      cardCount: cardCount
    });
  }
  return createJsonResponse({ status: "ok", decks: decks });
}

function handleCreateDeck(data) {
  const id = getNextId("NEXT_DECK_ID");
  const ss = SpreadsheetApp.getActive();

  // Add row to Decks sheet
  const decksSheet = ss.getSheetByName("Decks");
  decksSheet.appendRow([id, data.name || 'Untitled Deck', data.description || '', nowIso(), '', 'Active']);

  // Create a new sheet tab for this deck's cards
  const sheetName = getDeckSheetName(id);
  const deckSheet = ss.insertSheet(sheetName);
  deckSheet.appendRow(['id', 'question', 'answer', 'notes', 'photoUrl', 'created', 'modified', 'status']);

  return createJsonResponse({ status: "ok", id: id });
}

function handleUpdateDeck(data) {
  const rows = getSheetData("Decks");
  const sheet = SpreadsheetApp.getActive().getSheetByName("Decks");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      if (data.name !== undefined) sheet.getRange(i + 1, 2).setValue(data.name);
      if (data.description !== undefined) sheet.getRange(i + 1, 3).setValue(data.description);
      return createJsonResponse({ status: "ok" });
    }
  }
  return createJsonResponse({ status: "error", message: "Deck not found" });
}

function handleDeleteDeck(data) {
  const ss = SpreadsheetApp.getActive();
  const decksSheet = ss.getSheetByName("Decks");
  const rows = getSheetData("Decks");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      // Soft delete deck
      decksSheet.getRange(i + 1, 6).setValue('Inactive');

      // Soft delete all cards in the deck sheet
      const deckSheet = getDeckSheet(data.id);
      if (deckSheet) {
        const cardRows = deckSheet.getDataRange().getValues();
        for (let j = 1; j < cardRows.length; j++) {
          if (cardRows[j][7] === 'Active') {
            deckSheet.getRange(j + 1, 8).setValue('Inactive');
          }
        }
      }
      return createJsonResponse({ status: "ok" });
    }
  }
  return createJsonResponse({ status: "error", message: "Deck not found" });
}

// ─── Card Handlers ───

function handleGetCards(deckId) {
  if (!deckId) return createJsonResponse({ status: "ok", cards: [] });
  const deckSheet = getDeckSheet(deckId);
  if (!deckSheet) return createJsonResponse({ status: "ok", cards: [] });
  const rows = deckSheet.getDataRange().getValues();
  const cards = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] !== 'Active') continue;
    cards.push({
      id: String(rows[i][0]),
      deckId: deckId,
      question: rows[i][1],
      answer: rows[i][2],
      notes: rows[i][3],
      photoUrl: rows[i][4],
      created: rows[i][5],
      modified: rows[i][6]
    });
  }
  return createJsonResponse({ status: "ok", cards: cards });
}

function handleGetCard(deckId, cardId) {
  if (!deckId || !cardId) return createJsonResponse({ status: "error", message: "Missing deckId or cardId" });
  const deckSheet = getDeckSheet(deckId);
  if (!deckSheet) return createJsonResponse({ status: "error", message: "Deck sheet not found" });
  const rows = deckSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] !== 'Active') continue;
    if (String(rows[i][0]) === String(cardId)) {
      return createJsonResponse({
        status: "ok",
        card: {
          id: String(rows[i][0]),
          deckId: deckId,
          question: rows[i][1],
          answer: rows[i][2],
          notes: rows[i][3],
          photoUrl: rows[i][4],
          created: rows[i][5],
          modified: rows[i][6]
        }
      });
    }
  }
  return createJsonResponse({ status: "error", message: "Card not found" });
}

function handleCreateCard(data) {
  if (!data.deckId) return createJsonResponse({ status: "error", message: "Missing deckId" });
  const deckSheet = getDeckSheet(data.deckId);
  if (!deckSheet) return createJsonResponse({ status: "error", message: "Deck sheet not found" });
  const id = getNextId("NEXT_CARD_ID");
  const ts = nowIso();
  deckSheet.appendRow([id, data.question || '', data.answer || '', data.notes || '', data.photoUrl || '', ts, ts, 'Active']);
  return createJsonResponse({ status: "ok", id: id });
}

function handleUpdateCard(data) {
  if (!data.deckId || !data.id) return createJsonResponse({ status: "error", message: "Missing deckId or id" });
  const deckSheet = getDeckSheet(data.deckId);
  if (!deckSheet) return createJsonResponse({ status: "error", message: "Deck sheet not found" });
  const rows = deckSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] !== 'Active') continue;
    if (String(rows[i][0]) === String(data.id)) {
      if (data.question !== undefined) deckSheet.getRange(i + 1, 2).setValue(data.question);
      if (data.answer !== undefined) deckSheet.getRange(i + 1, 3).setValue(data.answer);
      if (data.notes !== undefined) deckSheet.getRange(i + 1, 4).setValue(data.notes);
      if (data.photoUrl !== undefined) deckSheet.getRange(i + 1, 5).setValue(data.photoUrl);
      deckSheet.getRange(i + 1, 7).setValue(nowIso());
      return createJsonResponse({ status: "ok" });
    }
  }
  return createJsonResponse({ status: "error", message: "Card not found" });
}

function handleDeleteCard(data) {
  if (!data.deckId || !data.id) return createJsonResponse({ status: "error", message: "Missing deckId or id" });
  const deckSheet = getDeckSheet(data.deckId);
  if (!deckSheet) return createJsonResponse({ status: "error", message: "Deck sheet not found" });
  const rows = deckSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] !== 'Active') continue;
    if (String(rows[i][0]) === String(data.id)) {
      deckSheet.getRange(i + 1, 8).setValue('Inactive');
      return createJsonResponse({ status: "ok" });
    }
  }
  return createJsonResponse({ status: "error", message: "Card not found" });
}

function handleSearchCards(query, deckId) {
  if (!query) return createJsonResponse({ status: "ok", cards: [] });
  const q = query.trim().toLowerCase();
  const results = [];

  // Search specific deck or all decks
  const deckIds = deckId ? [deckId] : getAllDeckIds();

  for (const did of deckIds) {
    const deckSheet = getDeckSheet(did);
    if (!deckSheet) continue;
    const rows = deckSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][7] !== 'Active') continue;
      const question = (rows[i][1] || '').toLowerCase();
      const answer = (rows[i][2] || '').toLowerCase();
      const notes = (rows[i][3] || '').toLowerCase();
      if (question.includes(q) || answer.includes(q) || notes.includes(q)) {
        results.push({
          id: String(rows[i][0]),
          deckId: did,
          question: rows[i][1],
          answer: rows[i][2],
          notes: rows[i][3],
          photoUrl: rows[i][4]
        });
      }
    }
  }
  return createJsonResponse({ status: "ok", cards: results });
}

// ─── SRS & CardState ───

function getCardState(userId, cardId) {
  const rows = getSheetData("CardState");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId) && String(rows[i][1]) === String(cardId)) {
      return {
        row: i,
        easeFactor: parseFloat(rows[i][2]) || 2.5,
        intervalDays: parseInt(rows[i][3]) || 0,
        dueDate: rows[i][4] || '',
        reviewCount: parseInt(rows[i][5]) || 0
      };
    }
  }
  return null;
}

function upsertCardState(userId, cardId, easeFactor, intervalDays, dueDate, reviewCount) {
  const existing = getCardState(userId, cardId);
  const sheet = SpreadsheetApp.getActive().getSheetByName("CardState");
  if (existing) {
    sheet.getRange(existing.row + 1, 3).setValue(easeFactor);
    sheet.getRange(existing.row + 1, 4).setValue(intervalDays);
    sheet.getRange(existing.row + 1, 5).setValue(dueDate);
    sheet.getRange(existing.row + 1, 6).setValue(reviewCount);
  } else {
    sheet.appendRow([userId, cardId, easeFactor, intervalDays, dueDate, reviewCount]);
  }
}

function computeNextReview(state, rating) {
  let { easeFactor, intervalDays, reviewCount } = state;

  if (rating === 1) {
    intervalDays = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (rating === 2) {
    intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === 3) {
    if (reviewCount === 0) intervalDays = 1;
    else if (reviewCount === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
  } else if (rating === 4) {
    if (reviewCount === 0) intervalDays = 4;
    else intervalDays = Math.round(intervalDays * easeFactor * 1.3);
    easeFactor = easeFactor + 0.15;
  }

  const due = new Date();
  due.setDate(due.getDate() + intervalDays);

  return {
    easeFactor: Math.round(easeFactor * 100) / 100,
    intervalDays: intervalDays,
    dueDate: due.toISOString().split('T')[0],
    reviewCount: reviewCount + 1
  };
}

function handleRateCard(data) {
  const userId = getUserIdFromHash(data.pwHash);
  if (!userId) return createJsonResponse({ status: "error", message: "Unauthorized" });

  const { cardId, deckId, rating, responseTimeMs, sessionBatchId } = data;
  if (!cardId || !rating) return createJsonResponse({ status: "error", message: "Missing cardId or rating" });

  let state = getCardState(userId, cardId);
  if (!state) {
    state = { easeFactor: 2.5, intervalDays: 0, dueDate: todayIso(), reviewCount: 0 };
  }

  const next = computeNextReview(state, rating);
  upsertCardState(userId, cardId, next.easeFactor, next.intervalDays, next.dueDate, next.reviewCount);

  const logId = getNextId("NEXT_LOG_ID");
  const logSheet = SpreadsheetApp.getActive().getSheetByName("Logs");
  logSheet.appendRow([logId, userId, deckId || '', cardId, rating, responseTimeMs || 0, nowIso(), sessionBatchId || '']);

  return createJsonResponse({
    status: "ok",
    nextReview: {
      dueDate: next.dueDate,
      intervalDays: next.intervalDays,
      easeFactor: next.easeFactor
    }
  });
}

// ─── Due Cards ───

function handleGetDueCards(deckId, pwHash) {
  const userId = getUserIdFromHash(pwHash);
  if (!userId) return createJsonResponse({ status: "error", message: "Unauthorized" });

  const today = todayIso();
  const dueCards = [];

  // Get cards from specific deck or all decks
  const deckIds = deckId ? [deckId] : getAllDeckIds();

  for (const did of deckIds) {
    const deckSheet = getDeckSheet(did);
    if (!deckSheet) continue;
    const cardRows = deckSheet.getDataRange().getValues();

    for (let i = 1; i < cardRows.length; i++) {
      if (cardRows[i][7] !== 'Active') continue;

      const cardId = String(cardRows[i][0]);
      const state = getCardState(userId, cardId);

      if (!state || !state.dueDate || state.dueDate <= today) {
        dueCards.push({
          id: cardId,
          deckId: did,
          question: cardRows[i][1],
          answer: cardRows[i][2],
          notes: cardRows[i][3],
          photoUrl: cardRows[i][4],
          easeFactor: state ? state.easeFactor : 2.5,
          intervalDays: state ? state.intervalDays : 0,
          reviewCount: state ? state.reviewCount : 0
        });
      }
    }
  }

  dueCards.sort((a, b) => {
    if (a.reviewCount === 0 && b.reviewCount > 0) return -1;
    if (a.reviewCount > 0 && b.reviewCount === 0) return 1;
    return 0;
  });

  return createJsonResponse({ status: "ok", cards: dueCards });
}

// ─── Deck Stats ───

function handleGetDeckStats(deckId, pwHash) {
  const userId = getUserIdFromHash(pwHash);
  if (!userId) return createJsonResponse({ status: "error", message: "Unauthorized" });

  const today = todayIso();
  let total = 0, dueToday = 0, mastered = 0;

  // Get cards from specific deck or all decks
  const deckIds = deckId ? [deckId] : getAllDeckIds();

  for (const did of deckIds) {
    const deckSheet = getDeckSheet(did);
    if (!deckSheet) continue;
    const cardRows = deckSheet.getDataRange().getValues();

    for (let i = 1; i < cardRows.length; i++) {
      if (cardRows[i][7] !== 'Active') continue;
      total++;

      const cardId = String(cardRows[i][0]);
      const state = getCardState(userId, cardId);

      if (!state || !state.dueDate || state.dueDate <= today) {
        dueToday++;
      }
      if (state && state.intervalDays >= 21) {
        mastered++;
      }
    }
  }

  let reviewed = 0;
  const logRows = getSheetData("Logs");
  for (let i = 1; i < logRows.length; i++) {
    if (String(logRows[i][1]) !== String(userId)) continue;
    if (deckId && String(logRows[i][2]) !== String(deckId)) continue;
    const logDate = (logRows[i][6] || '').split('T')[0];
    if (logDate === today) reviewed++;
  }

  return createJsonResponse({
    status: "ok",
    stats: { total: total, dueToday: dueToday, reviewed: reviewed, mastered: mastered }
  });
}

// ─── Progress ───

function handleGetProgress(deckId, pwHash) {
  const userId = getUserIdFromHash(pwHash);
  if (!userId) return createJsonResponse({ status: "error", message: "Unauthorized" });

  const logRows = getSheetData("Logs");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0];
  const today = todayIso();

  let totalReviews = 0, correctReviews = 0;
  const dailyReviews = {};

  for (let i = 1; i < logRows.length; i++) {
    if (String(logRows[i][1]) !== String(userId)) continue;
    if (deckId && String(logRows[i][2]) !== String(deckId)) continue;
    const logDate = (logRows[i][6] || '').split('T')[0];
    if (logDate < cutoff) continue;

    totalReviews++;
    const rating = parseInt(logRows[i][4]);
    if (rating >= 3) correctReviews++;

    if (!dailyReviews[logDate]) dailyReviews[logDate] = 0;
    dailyReviews[logDate]++;
  }

  const accuracy = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;

  let streak = 0;
  const d = new Date();
  while (true) {
    const dateStr = d.toISOString().split('T')[0];
    if (dailyReviews[dateStr]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Find weak cards across all relevant deck sheets
  const weakCards = [];
  const deckIds = deckId ? [deckId] : getAllDeckIds();

  for (const did of deckIds) {
    const deckSheet = getDeckSheet(did);
    if (!deckSheet) continue;
    const cardRows = deckSheet.getDataRange().getValues();

    for (let i = 1; i < cardRows.length; i++) {
      if (cardRows[i][7] !== 'Active') continue;
      const cardId = String(cardRows[i][0]);
      const state = getCardState(userId, cardId);
      if (state && state.easeFactor < 2.0) {
        weakCards.push({
          id: cardId,
          deckId: did,
          question: cardRows[i][1],
          answer: cardRows[i][2],
          easeFactor: state.easeFactor,
          intervalDays: state.intervalDays
        });
      }
    }
  }

  const suggestions = [];
  const hasReviewedToday = dailyReviews[today] > 0;

  if (weakCards.length > 0) {
    suggestions.push("Focus on " + weakCards.length + " difficult card" + (weakCards.length > 1 ? "s" : ""));
  }
  if (!hasReviewedToday && totalReviews > 0) {
    suggestions.push("You haven't reviewed today");
  }
  if (accuracy < 60 && totalReviews > 10) {
    suggestions.push("Try fewer cards per session to improve retention");
  }
  if (accuracy > 90 && streak >= 5 && totalReviews > 20) {
    suggestions.push("Great progress! Consider adding new cards");
  }

  return createJsonResponse({
    status: "ok",
    progress: {
      accuracy: accuracy,
      streak: streak,
      totalReviews: totalReviews,
      weakCards: weakCards,
      suggestions: suggestions
    }
  });
}

// ─── Session Logs ───

function handleGetSessionLogs(deckId, pwHash, from, to) {
  const userId = getUserIdFromHash(pwHash);
  if (!userId) return createJsonResponse({ status: "error", message: "Unauthorized" });

  const logRows = getSheetData("Logs");
  const logs = [];
  for (let i = 1; i < logRows.length; i++) {
    if (String(logRows[i][1]) !== String(userId)) continue;
    if (deckId && String(logRows[i][2]) !== String(deckId)) continue;
    const logDate = (logRows[i][6] || '').split('T')[0];
    if (from && logDate < from) continue;
    if (to && logDate > to) continue;
    logs.push({
      id: String(logRows[i][0]),
      userId: String(logRows[i][1]),
      deckId: String(logRows[i][2]),
      cardId: String(logRows[i][3]),
      rating: parseInt(logRows[i][4]),
      responseTimeMs: parseInt(logRows[i][5]),
      timestamp: logRows[i][6],
      sessionBatchId: logRows[i][7]
    });
  }
  return createJsonResponse({ status: "ok", logs: logs });
}

// ─── Photo Upload ───

function handleUploadPhoto(data) {
  if (!data.photoData) return createJsonResponse({ status: "error", message: "Missing photoData" });

  const match = data.photoData.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  if (!match) return createJsonResponse({ status: "error", message: "Invalid image data" });

  const mime = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, mime, data.photoName || 'photo.jpg');

  const folderPath = getConfig("PHOTOS_FOLDER_PATH");
  const folder = findOrCreateFolderByPath(folderPath);
  const file = folder.createFile(blob);
  DriveApp.getFileById(file.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return createJsonResponse({ status: "ok", photoUrl: file.getUrl() });
}

function findOrCreateFolderByPath(path) {
  if (!path) return DriveApp.getRootFolder();
  const parts = path.split('/');
  let current = DriveApp.getRootFolder();
  for (const part of parts) {
    if (!part) continue;
    let found = current.getFoldersByName(part);
    if (found.hasNext()) current = found.next();
    else current = current.createFolder(part);
  }
  return current;
}

// ─── GET Handler ───

function doGet(e) {
  const endpoint = e && e.parameter && e.parameter.endpoint;

  if (endpoint === "login") return handleLogin(e.parameter);

  if (!verifyAuth(e, null)) return createJsonResponse({ status: "error", message: "Unauthorized" });

  switch (endpoint) {
    case "getDecks": return handleGetDecks();
    case "getCards": return handleGetCards(e.parameter.deckId);
    case "getCard": return handleGetCard(e.parameter.deckId, e.parameter.cardId);
    case "getDueCards": return handleGetDueCards(e.parameter.deckId, e.parameter.pwHash);
    case "getDeckStats": return handleGetDeckStats(e.parameter.deckId, e.parameter.pwHash);
    case "getProgress": return handleGetProgress(e.parameter.deckId, e.parameter.pwHash);
    case "getSessionLogs": return handleGetSessionLogs(e.parameter.deckId, e.parameter.pwHash, e.parameter.from, e.parameter.to);
    case "searchCards": return handleSearchCards(e.parameter.query, e.parameter.deckId);
    default: return createJsonResponse({ status: "ok", message: "Flashy API ready" });
  }
}

// ─── POST Handler ───

function doPost(e) {
  let data = {};
  try {
    if (e && e.postData && e.postData.contents) data = JSON.parse(e.postData.contents);
  } catch (err) {}

  const endpoint = (e && e.parameter && e.parameter.endpoint) || data.endpoint || "ping";

  if (endpoint === "login") return handleLogin(data);

  if (!verifyAuth(null, data)) return createJsonResponse({ status: "error", message: "Unauthorized" });

  switch (endpoint) {
    case "createDeck": return handleCreateDeck(data);
    case "updateDeck": return handleUpdateDeck(data);
    case "deleteDeck": return handleDeleteDeck(data);
    case "createCard": return handleCreateCard(data);
    case "updateCard": return handleUpdateCard(data);
    case "deleteCard": return handleDeleteCard(data);
    case "rateCard": return handleRateCard(data);
    case "uploadPhoto": return handleUploadPhoto(data);
    default: return createJsonResponse({ status: "error", message: "Unknown endpoint: " + endpoint });
  }
}

// ─── Test Helpers ───

function testAuthentication() {
  const ss = SpreadsheetApp.getActive();
  const rows = getSheetData("Users");
  if (rows.length < 2) {
    return createJsonResponse({ status: "error", message: "No user rows found" });
  }

  const users = [];
  for (let i = 1; i < rows.length; i++) {
    users.push({
      userid: rows[i][0],
      password: rows[i][1],
      name: rows[i][2],
      status: rows[i][3],
      serverHash: sha256(rows[i][1])
    });
  }

  let authTestOk = false;
  for (const u of users) {
    if (u.status !== 'Active') continue;
    if (verifyAuth(null, { pwHash: u.serverHash })) {
      authTestOk = true;
      break;
    }
  }

  return createJsonResponse({
    status: "ok",
    usersFound: users.length,
    users: users,
    authRoundTripWorks: authTestOk
  });
}

function testGetDueCards() {
  const rows = getSheetData("Users");
  if (rows.length < 2) return Logger.log("No users found");
  const hash = sha256(rows[1][1]);
  const result = handleGetDecks();
  const decks = JSON.parse(result.getContent()).decks;
  if (decks.length === 0) return Logger.log("No decks found");
  const dueResult = handleGetDueCards(decks[0].id, hash);
  Logger.log("Due cards: " + dueResult.getContent());
}
