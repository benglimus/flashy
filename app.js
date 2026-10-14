const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ─── Utilities ───

const Spinner = ({ className = 'h-4 w-4' }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
  </svg>
);

const sha256 = async (message) => {
  // crypto.subtle requires secure context (HTTPS or localhost).
  // Fallback: pure JS SHA-256 for HTTP on LAN.
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(message);
};

// Pure JS SHA-256 fallback for insecure contexts
const sha256Fallback = async (message) => {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const msg = new TextEncoder().encode(message);
  const l = msg.length * 8;
  const ml = msg.length;
  const padded = new Uint8Array(((ml + 9 + 63) & ~63));
  padded.set(msg);
  padded[ml] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(l / 0x100000000), false);
  dv.setUint32(padded.length - 4, l >>> 0, false);
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const W = new Int32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getInt32(off + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t-15]>>>7)|(W[t-15]<<25))^((W[t-15]>>>18)|(W[t-15]<<14))^(W[t-15]>>>3);
      const s1 = ((W[t-2]>>>17)|(W[t-2]<<15))^((W[t-2]>>>19)|(W[t-2]<<13))^(W[t-2]>>>10);
      W[t] = (W[t-16]+s0+W[t-7]+s1)|0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));
      const ch = (e&f)^(~e&g);
      const t1 = (h+S1+ch+K[t]+W[t])|0;
      const S0 = ((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));
      const maj = (a&b)^(a&c)^(b&c);
      const t2 = (S0+maj)|0;
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(v=>((v>>>0).toString(16).padStart(8,'0'))).join('');
};


const getDirectPhotoUrl = (url) => {
  if (!url) return '';
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([^/?#]+)/);
  if (driveMatch) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  return url;
};

const speak = (text, lang, rate, pitch) => {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;
  window.speechSynthesis.speak(utterance);
};

const parseSpeakTag = (notes) => {
  if (!notes) return null;
  const match = notes.match(/\[SPEAK:([^,\]]+),([^,\]]+),([^\]]+)\](.*)/);
  if (!match) return null;
  return {
    lang: match[1].trim(),
    rate: parseFloat(match[2]),
    pitch: parseFloat(match[3]),
    text: match[4].trim(),
  };
};

const filterDisplayNotes = (notes) => {
  if (!notes) return '';
  return notes.split('\n').filter(l => !l.trimStart().startsWith('[')).join('\n').trim();
};

const API_URL_KEY = 'flashy_api_url';
const SESSION_KEY = 'flashy_session';
const SETTINGS_KEY = 'flashy_settings';

const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
};
const saveSettings = (s) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));


const apiGet = async (url) => {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
};

// ─── Local deck store (offline) ───
// Phase 1: decks are downloaded from the server into localStorage and rendered locally.
// Users can only download / delete decks and export stats. No card-content editing.
const DECKS_KEY = 'flashy_decks';
const LOGS_KEY = 'flashy_logs';
const todayIso = () => new Date().toISOString().split('T')[0];
const defaultSrsCard = () => ({ easeFactor: 2.5, intervalDays: 0, dueDate: todayIso(), reviewCount: 0 });
const loadLocalDecks = () => {
  try { return JSON.parse(localStorage.getItem(DECKS_KEY)) || {}; } catch { return {}; }
};
const saveLocalDecks = (decks) => localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
const listLocalDeckIds = () => Object.keys(loadLocalDecks());
const loadLocalLogs = () => {
  try { return JSON.parse(localStorage.getItem(LOGS_KEY)) || []; } catch { return []; }
};
const saveLocalLogs = (logs) => localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
const appendLocalLog = (log) => {
  const logs = loadLocalLogs();
  logs.push(log);
  saveLocalLogs(logs);
};
const deleteLocalDeck = (deckId) => {
  const decks = loadLocalDecks();
  delete decks[String(deckId)];
  saveLocalDecks(decks);
};
const clearLocalDecks = () => {
  saveLocalDecks({});
  saveLocalLogs([]);
};
// Download a deck's cards (cards only; SRS starts fresh) into localStorage.
// meta is a deck object from the server getDecks catalog.
const downloadDeck = async (meta, session) => {
  const res = await apiGet(`${session.url}?endpoint=getCards&deckId=${encodeURIComponent(meta.id)}&pwHash=${session.pwHash}`);
  if (res.status !== 'ok') throw new Error(res.message || 'Download failed');
  const deck = {
    id: String(meta.id),
    name: meta.name || 'Deck',
    description: meta.description || '',
    created: meta.created || todayIso(),
    syncedAt: new Date().toISOString(),
    cards: (res.cards || []).map(c => ({ id: String(c.id), front: c.front, back: c.back, notes: c.notes, photoUrl: c.photoUrl, created: c.created, modified: c.modified })),
    srs: {},
  };
  const decks = loadLocalDecks();
  decks[deck.id] = deck;
  saveLocalDecks(decks);
  return deck;
};
// Apply a review rating locally: update SRS state + append to the local log. SRS math ported from code.gs.
const computeNextReview = (state, rating) => {
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
    intervalDays,
    dueDate: due.toISOString().split('T')[0],
    reviewCount: reviewCount + 1,
  };
};
// Local stats for a downloaded deck. Missing SRS state counts as due-today.
const getLocalStats = (deck) => {
  if (!deck) return { total: 0, dueToday: 0, mastered: 0, reviewedToday: 0 };
  const today = todayIso();
  const total = deck.cards ? deck.cards.length : 0;
  let dueToday = 0, mastered = 0;
  const srs = deck.srs || {};
  for (const c of deck.cards || []) {
    const st = srs[String(c.id)];
    if (!st || !st.dueDate || st.dueDate <= today) dueToday++;
    if (st && st.intervalDays >= 21) mastered++;
  }
  const logs = loadLocalLogs().filter(l => String(l.deckId) === String(deck.id));
  const reviewedToday = logs.filter(l => (l.timestamp || '').split('T')[0] === today).length;
  return { total, dueToday, mastered, reviewedToday };
};
// Local progress, ported from code.gs getProgress(), computed from localStorage.
const getLocalProgress = () => {
  const decks = Object.values(loadLocalDecks());
  const logs = loadLocalLogs();
  let totalReviews = logs.length, correctReviews = 0;
  const dailyReviews = {};
  for (const l of logs) {
    const rating = parseInt(l.rating);
    if (!isNaN(rating) && rating >= 3) correctReviews++;
    const day = String(l.timestamp || '').split('T')[0];
    if (day) dailyReviews[day] = (dailyReviews[day] || 0) + 1;
  }
  const accuracy = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;
  let streak = 0;
  const d = new Date();
  while (true) {
    const dateStr = d.toISOString().split('T')[0];
    if (dailyReviews[dateStr]) { streak++; d.setDate(d.getDate() - 1); } else { break; }
  }
  const weakCards = [];
  for (const deck of decks) {
    const srs = deck.srs || {};
    for (const c of deck.cards || []) {
      const st = srs[String(c.id)];
      if (st && st.easeFactor < 2.0) {
        weakCards.push({ id: c.id, deckId: deck.id, front: c.front, back: c.back, easeFactor: st.easeFactor, intervalDays: st.intervalDays });
      }
    }
  }
  const today = todayIso();
  const hasReviewedToday = (dailyReviews[today] || 0) > 0;
  const suggestions = [];
  if (weakCards.length > 0) suggestions.push("Focus on " + weakCards.length + " difficult card" + (weakCards.length > 1 ? "s" : ""));
  if (!hasReviewedToday && totalReviews > 0) suggestions.push("You haven't reviewed today");
  if (accuracy < 60 && totalReviews > 10) suggestions.push("Try fewer cards per session to improve retention");
  if (accuracy > 90 && streak >= 5 && totalReviews > 20) suggestions.push("Great progress! Consider adding new cards");
  return { accuracy, streak, totalReviews, weakCards, suggestions };
};

// Export all local stats + logs as a downloadable JSON file.
const exportStatsJSON = (session) => {
  const decks = loadLocalDecks();
  const logs = loadLocalLogs();
  const payload = {
    app: 'flashy',
    exportedAt: new Date().toISOString(),
    userid: session?.userid || null,
    decks: Object.values(decks).map(d => ({ id: d.id, name: d.name, description: d.description, syncedAt: d.syncedAt, ...getLocalStats(d) })),
    logs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flashy-stats-${session?.userid || 'user'}-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return payload;
};
// ─── AuthScreen ───

const AuthScreen = ({ onLogin }) => {
  const settings = loadSettings();
  const [url, setUrl] = useState(localStorage.getItem(API_URL_KEY) || '');
  const [userid, setUserid] = useState(settings.userid || '');
  const [password, setPassword] = useState(settings.password || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!url || !userid || !password) { setError('All fields required'); return; }
    setLoading(true); setError('');
    try {
      localStorage.setItem(API_URL_KEY, url);
      const pwHash = await sha256(password);
      const loginUrl = `${url}?endpoint=login&pwHash=${pwHash}`;
      console.log('Attempting login to:', loginUrl);
      const res = await apiGet(loginUrl);
      if (res.status === 'ok') {
        const session = { url, pwHash, userid, name: res.user.name };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        saveSettings({ url, userid, password });
        onLogin(session);
      } else {
        setError(res.message || 'Login failed');
      }
    } catch (e) {
      console.error('Login error:', e);
      setError('Network error — ' + (e.message || 'check URL and CORS settings'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">Flashy</h1>
        <input className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
          placeholder="GAS Web App URL" value={url} onChange={e => setUrl(e.target.value)} />
        <input className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
          placeholder="User ID" value={userid} onChange={e => setUserid(e.target.value)} />
        <input className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
          placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
          disabled={loading} onClick={handleLogin}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </div>
  );
};


// ─── DownloadDecksModal ───
// Shows the server's deck catalog and pulls a deck's cards into localStorage.
const DownloadDecksModal = ({ session, onClose, onChanged }) => {
  const [remoteDecks, setRemoteDecks] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const res = await apiGet(`${session.url}?endpoint=getDecks&pwHash=${session.pwHash}`);
      setRemoteDecks(res.status === 'ok' ? (res.decks || []) : []);
    } catch (err) {
      setError('Could not reach server. Check the Web App URL / connection.');
      console.error(err);
      setRemoteDecks([]);
    }
  }, [session]);

  useEffect(() => { reload(); }, [reload]);

  const handleDownload = async (deck) => {
    setDownloading(deck.id);
    setError('');
    try {
      await downloadDeck(deck, session);
      if (onChanged) onChanged();
    } catch (err) {
      setError('Download failed: ' + err.message);
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  const downloadedIds = new Set(listLocalDeckIds());
  const isDownloaded = (id) => downloadedIds.has(String(id));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-4 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Download decks</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {remoteDecks === null ? (
          <div className="py-8 flex justify-center"><Spinner className="h-6 w-6 text-blue-600" /></div>
        ) : remoteDecks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No decks available on the server.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {remoteDecks.map(deck => {
              const done = !downloading && isDownloaded(deck.id);
              return (
                <div key={deck.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{deck.name}</p>
                    <p className="text-xs text-gray-500">{deck.cardCount ?? 0} cards</p>
                  </div>
                  {done ? (
                    <span className="text-green-500 text-xs font-medium">Downloaded</span>
                  ) : (
                    <button onClick={() => handleDownload(deck)} disabled={downloading !== null}
                      className="text-blue-600 text-sm font-medium disabled:opacity-50 min-h-[44px] px-3">
                      {downloading === deck.id ? '...' : 'Download'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── DeckListScreen ───
// Phase 1: renders locally downloaded decks; the header menu offers
// Download / Export / Settings / Clear. Users cannot modify deck content.
const DeckListScreen = ({ session, onSelectDeck, onOpenSettings }) => {
  const [decks, setDecks] = useState(() => Object.values(loadLocalDecks()));
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const reload = useCallback(() => setDecks(Object.values(loadLocalDecks())), []);

  useEffect(() => { reload(); }, [reload]);

  const handleExport = () => { exportStatsJSON(session); setMenuOpen(false); };
  const handleDelete = (id) => { deleteLocalDeck(id); reload(); };
  const handleClear = () => { clearLocalDecks(); setShowConfirmClear(false); setMenuOpen(false); reload(); };

  const deckStats = {};
  for (const d of decks) deckStats[d.id] = getLocalStats(d);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold">Flashy</h1>
        <div className="relative">
          <button onClick={() => setMenuOpen(o => !o)}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 active:scale-95" aria-label="Menu">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                <button onClick={() => { setMenuOpen(false); setShowDownload(true); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Download decks</button>
                <button onClick={handleExport}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Export stats</button>
                <button onClick={() => { setMenuOpen(false); onOpenSettings(); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Settings</button>
                <button onClick={() => { setMenuOpen(false); setShowConfirmClear(true); }}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700">Clear local decks</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="p-4">
        {decks.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-4">No downloads yet</p>
            <p className="text-sm">Tap the menu top-right to download decks</p>
            <p className="text-sm text-gray-400">then choose Download decks</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {decks.map(deck => {
              const s = deckStats[deck.id];
              return (
                <div key={deck.id}
                  className="flex items-stretch bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button className="flex-1 text-left p-4" onClick={() => onSelectDeck(deck)}>
                    <p className="font-bold">{deck.name}</p>
                    {deck.description && <p className="text-xs text-gray-500 mt-1">{deck.description}</p>}
                    <div className="mt-2 flex items-center space-x-3 text-xs text-gray-400">
                      <span>{s.total || 0} cards</span>
                      {(s.dueToday || 0) > 0 && (
                        <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">
                          {s.dueToday} due
                        </span>
                      )}
                    </div>
                  </button>
                  <button onClick={() => handleDelete(deck.id)}
                    className="flex items-center px-3 text-gray-400 hover:text-red-500 active:scale-95 border-l border-gray-100 dark:border-gray-700" aria-label="Delete deck">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.9 12.1a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m1 0h14m-5 3v6m-4-6v6" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showDownload && <DownloadDecksModal session={session} onClose={() => setShowDownload(false)} onChanged={reload} />}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setShowConfirmClear(false)}>
          <div className="bg-white dark:bg-gray-800 w-full sm:max-w-sm sm:rounded-xl rounded-t-xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Clear all local decks?</h3>
            <p className="text-sm text-gray-500">This removes every downloaded deck and your local review log from this device. It does not affect the server.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirmClear(false)} className="flex-1 py-2 rounded-lg text-sm min-h-[44px] border border-gray-300 dark:border-gray-600">Cancel</button>
              <button onClick={handleClear} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm min-h-[44px]">Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ReviewScreen ───

const ReviewScreen = ({ session, deck, onBack }) => {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState('front→back');

  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0, startTime: Date.now() });
  const [complete, setComplete] = useState(false);
  const [srs, setSrs] = useState(() => ({ ...(deck.srs || {}) }));
  const cardRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    const loadDue = async () => {
      setLoading(true);
      try {
        const all = deck.cards || [];
        const st0 = deck.srs || {};
        const today = todayIso();
        setCards(all.filter(c => { const st = st0[String(c.id)]; return !st || st.dueDate <= today; }));
      } catch (err) {
        console.error('Error loading due cards:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDue();
  }, [session, deck]);

  const handleRate = async (rating) => {
    const card = cards[currentIndex];
    const responseTimeMs = Date.now() - touchStartRef.current.time;

    const prevState = srs[String(card.id)] || defaultSrsCard();
    const next = computeNextReview(prevState, rating);
    const updated = { ...srs, [String(card.id)]: next };
    setSrs(updated);
    const localDecks = loadLocalDecks();
    const ld = localDecks[String(deck.id)];
    if (ld) { ld.srs = updated; saveLocalDecks(localDecks); }
    appendLocalLog({ timestamp: new Date().toISOString(), cardId: String(card.id), deckId: String(deck.id), rating, responseTimeMs });

    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (rating >= 3 ? 1 : 0),
      startTime: prev.startTime
    }));

    if (currentIndex + 1 >= cards.length) {
      setComplete(true);
    } else {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    }
  };

  const handleTouchStart = (e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 20 && absDy < 20) {
      setFlipped(f => !f);
      return;
    }

    if (absDy > absDx && dy < -50 && flipped) {
      handleRate(3);
      return;
    }

    if (absDy > absDx && dy > 50 && flipped) {
      if (currentIndex + 1 >= cards.length) {
        setComplete(true);
      } else {
        setCurrentIndex(currentIndex + 1);
        setFlipped(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-4xl mb-4">All caught up!</p>
        <p className="text-gray-500 mb-6">No cards due for review in this deck</p>
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg" onClick={onBack}>Back to Decks</button>
      </div>
    );
  }

  if (complete) {
    const elapsed = Math.round((Date.now() - sessionStats.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const accuracy = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-6">
          <p className="text-5xl">{accuracy >= 80 ? 'Great job!' : accuracy >= 60 ? 'Nice work!' : 'Keep practicing!'}</p>
          <div className="space-y-2 text-gray-600 dark:text-gray-400">
            <p className="text-2xl font-bold">{accuracy}% accuracy</p>
            <p>{sessionStats.reviewed} cards reviewed in {mins}m {secs}s</p>
          </div>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-lg" onClick={onBack}>Done</button>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];
  const progress = ((currentIndex) / cards.length) * 100;
  const showFrontFirst = direction === 'front→back';
  const initialFace = showFrontFirst ? card.front : card.back;
  const flippedFace = showFrontFirst ? card.back : card.front;
  const speakTag = parseSpeakTag(card.notes);

  return (
    <div className="flex flex-col min-h-full bg-gray-50 dark:bg-gray-900 select-none">
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button onClick={onBack} aria-label="Exit review"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-transform">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          <span className="text-xs font-medium">Exit</span>
        </button>
        <span className="flex-1 text-center text-xs text-gray-500">{currentIndex + 1} / {cards.length}</span>
        <button className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:scale-95 transition-transform"
          onClick={() => setDirection(d => d === 'front→back' ? 'back→front' : 'front→back')}>
          {direction === 'front→back' ? 'front → back' : 'back → front'}
        </button>
      </div>

      <div className="h-1 bg-gray-200 dark:bg-gray-700">
        <div className="h-1 bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6"
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => setFlipped(f => !f)}>
        <div className="flashcard-flip w-full max-w-sm" style={{ minHeight: '300px' }}>
          <div className={`flashcard-inner w-full h-full ${flipped ? 'flipped' : ''}`} style={{ minHeight: '300px' }}>
            <div className="flashcard-front w-full h-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center p-6 min-h-[300px]">
              {card.photoUrl && (
                <img src={getDirectPhotoUrl(card.photoUrl)} className="max-w-full max-h-40 object-contain rounded-lg mb-4" alt="" />
              )}
              <p className="text-xl text-center font-medium">{initialFace}</p>
              {!flipped && <p className="text-xs text-gray-400 mt-4 swipe-hint">tap to reveal</p>}
            </div>
            <div className="flashcard-back w-full h-full bg-blue-50 dark:bg-blue-950/30 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-900/30 flex flex-col items-center justify-center p-6 min-h-[300px]">
              <p className="text-xl text-center font-bold text-blue-900 dark:text-blue-100">{flippedFace}</p>
              {card.notes && <p className="text-sm text-blue-700 dark:text-blue-300 mt-3 text-center">{filterDisplayNotes(card.notes)}</p>}
            </div>
          </div>
        </div>
      </div>

      {speakTag && (
        <div className="fixed bottom-40 left-6 z-30">
          <button className="w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            onClick={(e) => { e.stopPropagation(); speak(speakTag.text, speakTag.lang, speakTag.rate, speakTag.pitch); }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>
        </div>
      )}

      {flipped && (
        <div className="px-4 pb-6 pt-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe">
          <div className="flex space-x-2">
            <button className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium min-h-[52px] active:scale-95 transition-transform"
              onClick={() => handleRate(1)}>
              Again
            </button>
            <button className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium min-h-[52px] active:scale-95 transition-transform"
              onClick={() => handleRate(2)}>
              Hard
            </button>
            <button className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium min-h-[52px] active:scale-95 transition-transform"
              onClick={() => handleRate(3)}>
              Good
            </button>
            <button className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium min-h-[52px] active:scale-95 transition-transform"
              onClick={() => handleRate(4)}>
              Easy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── LearnScreen ───

const LearnScreen = ({ session, deck, onBack }) => {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  const [direction, setDirection] = useState('front→back');
  const touchStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const loadCards = async () => {
      setLoading(true);
      try {
        setCards(deck.cards || []);
      } catch (err) {
        console.error('Error loading cards:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCards();
  }, [session, deck]);

  const goNext = () => {
    setCurrentIndex(i => (i + 1) % cards.length);
    setFlipped(false);
  };

  const goPrev = () => {
    setCurrentIndex(i => (i - 1 + cards.length) % cards.length);
    setFlipped(false);
  };

  const handleTouchStart = (e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy && dx < -50) {
      goNext();
      return;
    }

    if (absDx > absDy && dx > 50) {
      goPrev();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-4xl mb-4">No cards yet</p>
        <p className="text-gray-500 mb-6">Add some cards to this deck first</p>
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg" onClick={onBack}>Back</button>
      </div>
    );
  }

  const card = cards[currentIndex];
  const showFrontFirst = direction === 'front→back';
  const initialFace = showFrontFirst ? card.front : card.back;
  const flippedFace = showFrontFirst ? card.back : card.front;
  const speakTag = parseSpeakTag(card.notes);

  return (
    <div className="flex flex-col min-h-full bg-gray-50 dark:bg-gray-900 select-none">
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="font-bold">Learn</span>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">{currentIndex + 1} / {cards.length}</span>
          <button className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:scale-95 transition-transform"
            onClick={() => setDirection(d => d === 'front→back' ? 'back→front' : 'front→back')}>
            {direction === 'front→back' ? 'front → back' : 'back → front'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => setFlipped(f => !f)}>
        <div className="flashcard-flip w-full max-w-sm" style={{ minHeight: '300px' }}>
          <div className={`flashcard-inner w-full h-full ${flipped ? 'flipped' : ''}`} style={{ minHeight: '300px' }}>
            <div className="flashcard-front w-full h-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center p-6 min-h-[300px]">
              {card.photoUrl && (
                <img src={getDirectPhotoUrl(card.photoUrl)} className="max-w-full max-h-40 object-contain rounded-lg mb-4" alt="" />
              )}
              <p className="text-xl text-center font-medium">{initialFace}</p>
              {!flipped && <p className="text-xs text-gray-400 mt-4 swipe-hint">tap to reveal</p>}
            </div>
            <div className="flashcard-back w-full h-full bg-blue-50 dark:bg-blue-950/30 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-900/30 flex flex-col items-center justify-center p-6 min-h-[300px]">
              <p className="text-xl text-center font-bold text-blue-900 dark:text-blue-100">{flippedFace}</p>
              {card.notes && <p className="text-sm text-blue-700 dark:text-blue-300 mt-3 text-center">{filterDisplayNotes(card.notes)}</p>}
            </div>
          </div>
        </div>
      </div>

      {speakTag && (
        <div className="fixed bottom-24 left-6 z-30">
          <button className="w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            onClick={(e) => { e.stopPropagation(); speak(speakTag.text, speakTag.lang, speakTag.rate, speakTag.pitch); }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>
        </div>
      )}

      <div className="px-4 pb-6 pt-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe">
        <div className="flex space-x-2">
          <button className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-medium min-h-[52px] active:scale-95 transition-transform"
            onClick={goPrev}>
            ← Prev
          </button>
          {/* <button className="py-3 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-medium min-h-[52px] active:scale-95 transition-transform"
            onClick={shuffleCards}>
            🔀
          </button> */}
          <button className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-medium min-h-[52px] active:scale-95 transition-transform"
            onClick={goNext}>
            Next →
          </button>
        </div>
      </div>

      <div className="fixed bottom-24 right-6 z-30">
        <button className="w-14 h-14 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          onClick={onBack}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
      </div>
    </div>
  );
};

// ─── DeckDetailScreen ───

const DeckDetailScreen = ({ deck, onBack, onReview, onLearn }) => {
  const [tab, setTab] = useState('cards');
  // Phase 2: deck content + stats are local. The user can only read and review.
  const cards = deck.cards || [];
  const stats = getLocalStats(deck);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="font-bold">{deck.name}</span>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button className={`flex-1 min-h-[44px] py-2 text-sm font-medium ${tab === 'cards' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('cards')}>Cards ({cards.length})</button>
        <button className={`flex-1 min-h-[44px] py-2 text-sm font-medium ${tab === 'stats' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('stats')}>Stats</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'cards' ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {cards.length === 0 && <p className="p-4 text-center text-gray-500">No cards in this deck</p>}
            {cards.map(card => (
              <div key={card.id} className="px-4 py-3 bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{card.front || '(no front)'}</p>
                    <p className="text-sm text-gray-500">{card.back}</p>
                    {card.notes && <p className="text-xs text-gray-400 mt-1">{filterDisplayNotes(card.notes)}</p>}
                    {card.photoUrl && (
                      <img src={getDirectPhotoUrl(card.photoUrl)} className="max-w-full max-h-40 object-contain rounded-lg mt-2" alt="" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <StatCard label="Total Cards" value={stats.total || 0} />
            <StatCard label="Due Today" value={stats.dueToday || 0} color="text-orange-500" />
            <StatCard label="Reviewed Today" value={stats.reviewedToday || 0} color="text-green-500" />
            <StatCard label="Mastered" value={stats.mastered || 0} color="text-blue-500" />
            <p className="text-xs text-gray-400">Reviews and card content are stored on this device.</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-72 right-6 z-30">
        <button className="w-14 h-14 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          onClick={onBack} aria-label="Back to decks">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
      </div>

      {(stats.total || 0) > 0 && (
        <div className="fixed bottom-56 right-6 z-30">
          <button className="w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            onClick={() => onLearn(deck)} aria-label="Learn">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </button>
        </div>
      )}
      {(stats.dueToday || 0) > 0 && (
        <div className="fixed bottom-40 right-6 z-30">
          <button className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform relative"
            onClick={() => onReview(deck)} aria-label="Review">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">{stats.dueToday}</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ─── StatCard ───

const StatCard = ({ label, value, color = '' }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
    <span className="text-sm text-gray-500">{label}</span>
    <span className={`text-lg font-bold ${color}`}>{value}</span>
  </div>
);

// ─── ProgressScreen ───
// Read-only: accuracy / streak / weak cards / suggestions are derived from
// the local review log (flashy_logs) and per-deck SRS state. No server call.
const ProgressScreen = () => {
  const [tick, setTick] = useState(0);
  const decks = useMemo(() => Object.values(loadLocalDecks()), [tick]);
  const progress = useMemo(() => getLocalProgress(), [tick]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold">Progress</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-3xl font-bold text-blue-600">{progress.accuracy}%</p>
            <p className="text-xs text-gray-500 mt-1">Accuracy</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-3xl font-bold text-purple-600">{progress.streak}</p>
            <p className="text-xs text-gray-500 mt-1">Day Streak</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-xl font-bold">{progress.totalReviews}</p>
          <p className="text-xs text-gray-500 mt-1">Total Reviews</p>
        </div>

        {progress.suggestions && progress.suggestions.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-900/30">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Suggestions</p>
            {progress.suggestions.map((s, i) => (
              <p key={i} className="text-sm text-blue-700 dark:text-blue-300 py-1">{s}</p>
            ))}
          </div>
        )}

        {progress.weakCards && progress.weakCards.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-500 mb-3">Weak Cards ({progress.weakCards.length})</p>
            {progress.weakCards.map(wc => (
              <div key={wc.id} className="py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <p className="text-sm font-medium truncate">{wc.front}</p>
                <p className="text-xs text-gray-400 truncate">{wc.back}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 mb-3">Decks</p>
          {decks.length === 0 ? (
            <p className="text-sm text-gray-400">No decks downloaded yet</p>
          ) : decks.map(d => {
            const st = getLocalStats(d);
            return (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-sm font-medium">{d.name}</span>
                <span className="text-xs text-gray-400">
                  {st.dueToday} due · {st.mastered}/{st.total} mastered
                </span>
              </div>
            );
          })}
        </div>

        {decks.length === 0 && (
          <p className="text-center text-xs text-gray-400">
            Download a deck (Decks → ⋮ → Download) to start tracking progress.
          </p>
        )}
      </div>

      <div className="fixed bottom-24 right-6 z-30">
        <button className="w-14 h-14 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          onClick={() => setTick(t => t + 1)} aria-label="Refresh">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>
    </div>
  );
};

// ─── SettingsModal ───

const SettingsModal = ({ session, onClose, onSettingsSaved, onLogout }) => {
  const settings = loadSettings();
  const [url, setUrl] = useState(settings.url || session?.url || '');
  const [userid, setUserid] = useState(settings.userid || session?.userid || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    const newSettings = { url: url.trim(), userid: userid.trim(), password };
    saveSettings(newSettings);
    localStorage.setItem(API_URL_KEY, url.trim());
    if (password) {
      const h = await sha256(password);
      const updatedSession = { ...session, url: url.trim(), userid: userid.trim(), pwHash: h };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
      onSettingsSaved(updatedSession);
    }
    setSaving(false);
    setMessage('Settings saved');
    setTimeout(() => setMessage(''), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Web App URL</label>
            <input className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm"
              value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">User ID</label>
            <input className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm"
              value={userid} onChange={e => setUserid(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Password (leave blank to keep current)</label>
            <input className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm"
              type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm min-h-[44px] disabled:opacity-50"
            disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="w-full py-2 bg-red-600 text-white rounded-lg text-sm min-h-[44px]" onClick={onLogout}>
            Logout
          </button>
        </div>

        {message && <p className="text-sm text-center text-green-500">{message}</p>}
      </div>
    </div>
  );
};

// ─── App (root) ───

const App = () => {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  });
  const [screen, setScreen] = useState('decks');
  const [currentDeck, setCurrentDeck] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleLogin = (s) => {
    setSession(s);
    setScreen('decks');
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCurrentDeck(null);
    setScreen('decks');
  };

  const handleSelectDeck = (deck) => {
    setCurrentDeck(deck);
    setScreen('detail');
  };

  const handleReview = (deck) => {
    setCurrentDeck(deck);
    setScreen('review');
  };

  const handleLearn = (deck) => {
    setCurrentDeck(deck);
    setScreen('learn');
  };

  const handleBackToDecks = () => {
    setScreen('decks');
    setCurrentDeck(null);
  };

  if (!session) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <main className="flex-1 min-h-0 overflow-y-auto">
      {screen === 'decks' && (
        <DeckListScreen session={session} onSelectDeck={handleSelectDeck} onOpenSettings={() => setShowSettings(true)} />
      )}
      {screen === 'detail' && currentDeck && (
        <DeckDetailScreen session={session} deck={currentDeck} onBack={handleBackToDecks} onReview={handleReview} onLearn={handleLearn} />
      )}
      {screen === 'review' && currentDeck && (
        <ReviewScreen session={session} deck={currentDeck} onBack={handleBackToDecks} />
      )}
      {screen === 'learn' && currentDeck && (
        <LearnScreen session={session} deck={currentDeck} onBack={handleBackToDecks} />
      )}
      {screen === 'progress' && (
        <ProgressScreen />
      )}

      </main>
      <nav className="flex flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pb-safe">
        <button className={`flex-1 min-h-[48px] py-3 text-sm font-medium flex flex-col items-center justify-center ${screen === 'decks' || screen === 'detail' || screen === 'review' ? 'text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setScreen('decks'); setCurrentDeck(null); }}>
          <span className="text-xl mb-0.5">Decks</span>
        </button>
        <button className={`flex-1 min-h-[48px] py-3 text-sm font-medium flex flex-col items-center justify-center ${screen === 'progress' ? 'text-blue-600' : 'text-gray-500'}`}
          onClick={() => setScreen('progress')}>
          <span className="text-xl mb-0.5">Progress</span>
        </button>
      </nav>

      {showSettings && (
        <SettingsModal session={session} onClose={() => setShowSettings(false)}
          onSettingsSaved={(updated) => { setSession(updated); setShowSettings(false); }}
          onLogout={() => { setShowSettings(false); handleLogout(); }} />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
