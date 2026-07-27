const { useState, useEffect, useRef, useCallback } = React;

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

const compressImage = (file, maxWidth = 1280, quality = 0.7) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
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

const apiPost = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST', mode: 'cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body)
  });
  return await res.json();
};

const apiGet = async (url) => {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
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

// ─── AddDeckModal ───

const AddDeckModal = ({ session, onClose, onAdded }) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    await apiPost(session.url, { endpoint: 'createDeck', pwHash: session.pwHash, name, description: desc });
    onAdded();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold">New Deck</h3>
        <input className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700"
          placeholder="Deck name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <textarea className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700"
          placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
        <div className="flex space-x-2">
          <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg min-h-[44px] disabled:opacity-50 flex items-center justify-center space-x-2"
            disabled={!name.trim() || submitting} onClick={handleSubmit}>
            {submitting && <Spinner />}
            <span>Create</span>
          </button>
          <button className="flex-1 py-2 bg-gray-400 text-white rounded-lg" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── AddCardModal ───

const AddCardModal = ({ deckId, session, onClose, onAdded }) => {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(await compressImage(file));
  };

  const handleSubmit = async () => {
    if (!front.trim() || !back.trim()) return;
    setSubmitting(true);
    let photoUrl = '';
    if (photoFile) {
      const dataUrl = await compressImage(photoFile);
      const res = await apiPost(session.url, { endpoint: 'uploadPhoto', pwHash: session.pwHash, photoData: dataUrl, photoName: photoFile.name });
      if (res && res.status === 'ok' && res.photoUrl) photoUrl = res.photoUrl;
    }
    await apiPost(session.url, { endpoint: 'createCard', pwHash: session.pwHash, deckId, front, back, notes, photoUrl });
    onAdded();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-4 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold">Add Card</h3>
        <textarea className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700"
          placeholder="Front" value={front} onChange={e => setFront(e.target.value)} rows={2} autoFocus />
        <textarea className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700"
          placeholder="Back" value={back} onChange={e => setBack(e.target.value)} rows={2} />
        <textarea className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700"
          placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        {photoPreview && (
          <div className="relative inline-block">
            <img src={photoPreview} className="w-24 h-24 object-cover rounded" alt="preview" />
            <button className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
              onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}>x</button>
          </div>
        )}
        <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handlePhotoChange} />
        <button className="text-sm text-blue-600" onClick={() => fileRef.current?.click()}>Add photo</button>
        <div className="flex space-x-2">
          <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg min-h-[44px] disabled:opacity-50 flex items-center justify-center space-x-2"
            disabled={!front.trim() || !back.trim() || submitting} onClick={handleSubmit}>
            {submitting && <Spinner />}
            <span>Add</span>
          </button>
          <button className="flex-1 py-2 bg-gray-400 text-white rounded-lg" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── DeckListScreen ───

const DeckListScreen = ({ session, onSelectDeck, onOpenSettings }) => {
  const [decks, setDecks] = useState([]);
  const [deckStats, setDeckStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadDecks = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [decksRes, statsRes] = await Promise.all([
        apiGet(`${session.url}?endpoint=getDecks&pwHash=${session.pwHash}`),
        apiGet(`${session.url}?endpoint=getAllDeckStats&pwHash=${session.pwHash}`)
      ]);
      if (decksRes.status === 'ok') {
        setDecks(decksRes.decks || []);
      }
      if (statsRes.status === 'ok') {
        setDeckStats(statsRes.deckStats || {});
      }
    } catch (err) {
      console.error('Error loading decks:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold">Flashy</h1>
      </div>

      <div className="p-4">
        {decks.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-4">No decks yet</p>
            <p className="text-sm">Tap + to create your first deck</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {decks.map(deck => {
              const s = deckStats[deck.id] || {};
              return (
                <button key={deck.id}
                  className="text-left p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors min-h-[120px]"
                  onClick={() => onSelectDeck(deck)}>
                  <p className="font-bold truncate">{deck.name}</p>
                  {deck.description && <p className="text-xs text-gray-500 truncate mt-1">{deck.description}</p>}
                  <div className="mt-3 flex items-center space-x-3 text-xs text-gray-400">
                    <span>{s.total || 0} cards</span>
                    {(s.dueToday || 0) > 0 && (
                      <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">
                        {s.dueToday} due
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-40 right-6 z-30">
        <button className="w-14 h-14 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          onClick={onOpenSettings}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>

      <div className="fixed bottom-24 right-6 z-30">
        <button className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-95"
          onClick={() => setShowAdd(true)}>+</button>
      </div>

      {showAdd && <AddDeckModal session={session} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); loadDecks(); }} />}
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
  const [sessionBatchId] = useState(() => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0, startTime: Date.now() });
  const [complete, setComplete] = useState(false);
  const cardRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    const loadDue = async () => {
      setLoading(true);
      try {
        const res = await apiGet(`${session.url}?endpoint=getDueCards&deckId=${deck.id}&pwHash=${session.pwHash}`);
        if (res.status === 'ok') setCards(res.cards || []);
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

    await apiPost(session.url, {
      endpoint: 'rateCard',
      pwHash: session.pwHash,
      cardId: card.id,
      deckId: deck.id,
      rating,
      responseTimeMs,
      sessionBatchId
    });

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
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 select-none">
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-500">{currentIndex + 1} / {cards.length}</span>
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
  const [shuffled, setShuffled] = useState(false);
  const [direction, setDirection] = useState('front→back');
  const touchStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const loadCards = async () => {
      setLoading(true);
      try {
        const res = await apiGet(`${session.url}?endpoint=getCards&deckId=${deck.id}&pwHash=${session.pwHash}`);
        if (res.status === 'ok') setCards(res.cards || []);
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

  const shuffleCards = () => {
    const shuffledArr = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffledArr);
    setCurrentIndex(0);
    setFlipped(false);
    setShuffled(true);
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
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 select-none">
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
          <button className="py-3 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-medium min-h-[52px] active:scale-95 transition-transform"
            onClick={shuffleCards}>
            🔀
          </button>
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

const DeckDetailScreen = ({ session, deck, onBack, onReview, onLearn }) => {
  const [tab, setTab] = useState('cards');
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState({});
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [cardsRes, statsRes, progressRes] = await Promise.all([
        apiGet(`${session.url}?endpoint=getCards&deckId=${deck.id}&pwHash=${session.pwHash}`),
        apiGet(`${session.url}?endpoint=getDeckStats&deckId=${deck.id}&pwHash=${session.pwHash}`),
        apiGet(`${session.url}?endpoint=getProgress&deckId=${deck.id}&pwHash=${session.pwHash}`)
      ]);
      if (cardsRes.status === 'ok') setCards(cardsRes.cards || []);
      if (statsRes.status === 'ok') setStats(statsRes.stats || {});
      if (progressRes.status === 'ok') setProgress(progressRes.progress || null);
    } catch (err) {
      console.error('Error loading deck:', err);
    } finally {
      setLoading(false);
    }
  }, [session, deck]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteCard = async (cardId) => {
    if (!confirm('Delete this card?')) return;
    setDeleting(cardId);
    await apiPost(session.url, { endpoint: 'deleteCard', pwHash: session.pwHash, deckId: deck.id, id: cardId });
    setDeleting(null);
    loadData();
  };

  const handleUpdateCard = async (cardId, updates) => {
    await apiPost(session.url, { endpoint: 'updateCard', pwHash: session.pwHash, deckId: deck.id, id: cardId, ...updates });
    setEditingCard(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="font-bold truncate">{deck.name}</span>
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
            {cards.length === 0 && <p className="p-4 text-center text-gray-500">No cards yet</p>}
            {cards.map(card => (
              <div key={card.id} className="px-4 py-3 bg-white dark:bg-gray-800">
                {editingCard === card.id ? (
                  <EditCardInline card={card} session={session}
                    onSave={(updates) => handleUpdateCard(card.id, updates)}
                    onCancel={() => setEditingCard(null)} />
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-medium truncate">{card.front}</p>
                      <p className="text-sm text-gray-500 truncate">{card.back}</p>
                      {card.notes && <p className="text-xs text-gray-400 truncate mt-1">{filterDisplayNotes(card.notes)}</p>}
                    </div>
                    <div className="flex space-x-1 flex-shrink-0">
                      <button className="p-2 text-gray-400 hover:text-blue-600" onClick={() => setEditingCard(card.id)}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-600"
                        disabled={deleting === card.id}
                        onClick={() => handleDeleteCard(card.id)}>
                        {deleting === card.id ? <Spinner className="h-5 w-5" /> : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <StatCard label="Total Cards" value={stats.total || 0} />
            <StatCard label="Due Today" value={stats.dueToday || 0} color="text-orange-500" />
            <StatCard label="Reviewed Today" value={stats.reviewed || 0} color="text-green-500" />
            <StatCard label="Mastered" value={stats.mastered || 0} color="text-blue-500" />
            {progress && (
              <>
                <StatCard label="Accuracy (30d)" value={`${progress.accuracy}%`} color={progress.accuracy >= 80 ? 'text-green-500' : progress.accuracy >= 60 ? 'text-orange-500' : 'text-red-500'} />
                <StatCard label="Streak" value={`${progress.streak} days`} color="text-purple-500" />
                {progress.weakCards && progress.weakCards.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-500 mb-2">Weak Cards ({progress.weakCards.length})</p>
                    {progress.weakCards.slice(0, 5).map(wc => (
                      <p key={wc.id} className="text-sm truncate py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        {wc.front}
                      </p>
                    ))}
                  </div>
                )}
                {progress.suggestions && progress.suggestions.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-900/30">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Suggestions</p>
                    {progress.suggestions.map((s, i) => (
                      <p key={i} className="text-sm text-blue-700 dark:text-blue-300 py-1">{s}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-72 right-6 z-30">
        <button className="w-14 h-14 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          onClick={onBack}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
      </div>

      {(stats.total || 0) > 0 && (
        <div className="fixed bottom-56 right-6 z-30">
          <button className="w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            onClick={() => onLearn(deck)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </button>
        </div>
      )}
      {(stats.dueToday || 0) > 0 && (
        <div className="fixed bottom-40 right-6 z-30">
          <button className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform relative"
            onClick={() => onReview(deck)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">{stats.dueToday}</span>
          </button>
        </div>
      )}
      {tab === 'cards' && (
        <div className="fixed bottom-24 right-6 z-30">
          <button className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-95"
            onClick={() => setShowAddCard(true)}>+</button>
        </div>
      )}

      {showAddCard && <AddCardModal deckId={deck.id} session={session} onClose={() => setShowAddCard(false)} onAdded={() => { setShowAddCard(false); loadData(); }} />}
    </div>
  );
};

// ─── EditCardInline ───

const EditCardInline = ({ card, session, onSave, onCancel }) => {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [notes, setNotes] = useState(card.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ front, back, notes });
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      <textarea className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm"
        value={front} onChange={e => setFront(e.target.value)} rows={2} />
      <textarea className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm"
        value={back} onChange={e => setBack(e.target.value)} rows={2} />
      <textarea className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm"
        value={notes} onChange={e => setNotes(e.target.value)} rows={1} placeholder="Notes" />
      <div className="flex space-x-2">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm min-h-[40px] disabled:opacity-50"
          disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button className="px-4 py-2 bg-gray-400 text-white rounded-lg text-sm" onClick={onCancel}>Cancel</button>
      </div>
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

const ProgressScreen = ({ session }) => {
  const [progress, setProgress] = useState(null);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deckRes, progRes] = await Promise.all([
        apiGet(`${session.url}?endpoint=getDecks&pwHash=${session.pwHash}`),
        apiGet(`${session.url}?endpoint=getProgress&pwHash=${session.pwHash}`)
      ]);
      if (deckRes.status === 'ok') setDecks(deckRes.decks || []);
      if (progRes.status === 'ok') setProgress(progRes.progress || null);
    } catch (err) {
      console.error('Error loading progress:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold">Progress</h1>
      </div>

      <div className="p-4 space-y-4">
        {progress && (
          <>
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
                <p className="text-sm text-gray-400">No decks yet</p>
              ) : decks.map(d => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <span className="text-sm font-medium">{d.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-24 right-6 z-30">
        <button className="w-14 h-14 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          onClick={load}>
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
    <div className="h-screen flex flex-col relative overflow-hidden">
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
        <ProgressScreen session={session} />
      )}

      <div className="flex border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button className={`flex-1 min-h-[48px] py-3 text-sm font-medium flex flex-col items-center justify-center ${screen === 'decks' || screen === 'detail' || screen === 'review' ? 'text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setScreen('decks'); setCurrentDeck(null); }}>
          <span className="text-xl mb-0.5">Decks</span>
        </button>
        <button className={`flex-1 min-h-[48px] py-3 text-sm font-medium flex flex-col items-center justify-center ${screen === 'progress' ? 'text-blue-600' : 'text-gray-500'}`}
          onClick={() => setScreen('progress')}>
          <span className="text-xl mb-0.5">Progress</span>
        </button>
      </div>

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
