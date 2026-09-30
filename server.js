const express = require('express');
const https = require('https');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID || "1rMgXtcmbr-B5byLr9ZC3o54W2BUm8v8My8ZVEsrzTgg";

// Tab names (regex-based lookup lato client-side non serve: qui i nomi esatti con emoji)
const TAB_VENDITE = process.env.TAB_VENDITE || "💅Vendite Regina";
const TAB_QC = process.env.TAB_QC || "💅Check-up QC prenotati";
const TAB_QUIZ = process.env.TAB_QUIZ || "Check-up Quiz prenotati";
const TAB_SALES = process.env.TAB_SALES || "Check-up Sales prenotati";
const TAB_ASSISTENZA = process.env.TAB_ASSISTENZA || "Check-up Assistenza prenotati";
const TAB_MANUALE = process.env.TAB_MANUALE || "Check-up Manuale prenotati";

// Credenziali login (via env)
const AUTH_USERS = (process.env.AUTH_USERS || "sofia@metodo:regina2026").split(",").map(p => {
  const [u, pw] = p.split(":");
  return { user: (u || "").trim().toLowerCase(), pass: (pw || "").trim() };
}).filter(x => x.user && x.pass);

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const sessions = new Map(); // token -> { user, expires }

function newSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 giorni
  sessions.set(token, { user, expires });
  return token;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function isAuthed(req) {
  const c = parseCookies(req.headers.cookie);
  const t = c.stv_session;
  if (!t) return null;
  const s = sessions.get(t);
  if (!s || s.expires < Date.now()) { sessions.delete(t); return null; }
  return s.user;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ────────────────── AUTH ROUTES ──────────────────

app.post('/api/login', (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const pass = String(req.body.password || "");
  const match = AUTH_USERS.find(u => u.user === email && u.pass === pass);
  if (!match) return res.status(401).json({ ok: false, error: "Credenziali non valide" });
  const token = newSession(email);
  res.setHeader('Set-Cookie', `stv_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`);
  res.json({ ok: true, user: email });
});

app.post('/api/logout', (req, res) => {
  const c = parseCookies(req.headers.cookie);
  if (c.stv_session) sessions.delete(c.stv_session);
  res.setHeader('Set-Cookie', `stv_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const u = isAuthed(req);
  if (!u) return res.status(401).json({ ok: false });
  res.json({ ok: true, user: u });
});

// ────────────────── GVIZ FETCH ──────────────────

function fetchGviz(sheetName) {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    https.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return https.get(r.headers.location, (r2) => collect(r2, resolve, reject)).on('error', reject);
      }
      collect(r, resolve, reject);
    }).on('error', reject);
  });
}

function collect(res, resolve, reject) {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    const match = data.match(/\{[\s\S]*\}/);
    if (!match) return reject(new Error(`No JSON in response (status ${res.statusCode}). Il foglio potrebbe non essere condiviso pubblicamente.`));
    try {
      resolve(JSON.parse(match[0]));
    } catch (e) {
      reject(new Error('Invalid JSON from Google Sheets'));
    }
  });
}

// ────────────────── PARSERS ──────────────────

function gvizDate(v) {
  if (v == null || v === "") return null;
  const s = String(v);
  const m = s.match(/Date\((\d+),(\d+),(\d+)/);
  if (m) {
    const y = +m[1];
    const mo = +m[2] + 1;
    const d = +m[3];
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // Prova ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Prova dd/mm/yyyy
  const it = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (it) {
    const y = it[3].length === 2 ? "20" + it[3] : it[3];
    return `${y}-${String(+it[2]).padStart(2, "0")}-${String(+it[1]).padStart(2, "0")}`;
  }
  return null;
}

function cell(row, idx) {
  return row && row.c && row.c[idx] ? row.c[idx].v : null;
}

function num(v) {
  if (v == null || v === "") return 0;
  return typeof v === "number" ? v : Number(String(v).replace(/[€.\s]/g, "").replace(",", ".")) || 0;
}

function str(v) {
  return v == null ? "" : String(v).trim();
}

function bool(v) {
  if (v === true) return true;
  if (typeof v === "string") return v.toUpperCase() === "TRUE" || v === "1";
  return false;
}

// Parse Vendite Regina: A=Data vendita, B=Nome, C=Cognome, D=Email, E=Telefono,
// F=Coach, G=Prodotto, H=Importo, I=Modalità, J=NRate, K=RateIncass, L=Data incasso,
// M=Funnel, N=Note, O=Data prospect
function parseVendite(g) {
  if (!g || !g.table || !g.table.rows) return [];
  return g.table.rows.map(r => ({
    dataVendita: gvizDate(cell(r, 0)),
    nome: str(cell(r, 1)),
    cognome: str(cell(r, 2)),
    email: str(cell(r, 3)),
    telefono: str(cell(r, 4)),
    coach: str(cell(r, 5)),
    prodotto: str(cell(r, 6)),
    importo: num(cell(r, 7)),
    modalita: str(cell(r, 8)),
    nRate: num(cell(r, 9)),
    rateIncassate: num(cell(r, 10)),
    dataIncasso: gvizDate(cell(r, 11)),
    funnel: str(cell(r, 12)),
    note: str(cell(r, 13)),
    dataProspect: gvizDate(cell(r, 14))
  })).filter(x => x.dataVendita || x.nome);
}

// Parse check-up: A=Data compilazione, B=Nome, C=Cognome, D=Telefono, E=Email,
// R=Coach (18), S=SETTING (19), X=DATA CHECK-UP (24), Y=CHECK UP (25),
// AB=VENDUTO (28), AE=PROD VEND (31), AF=IMPORTO (32)
function parseCheckup(g, funnel) {
  if (!g || !g.table || !g.table.rows) return [];
  return g.table.rows.map(r => ({
    dataProspect: gvizDate(cell(r, 0)),
    nome: str(cell(r, 1)),
    cognome: str(cell(r, 2)),
    telefono: str(cell(r, 3)),
    email: str(cell(r, 4)),
    coach: str(cell(r, 17)),
    setting: bool(cell(r, 18)),
    dataCheckup: gvizDate(cell(r, 23)),
    checkupStato: str(cell(r, 24)),
    venduto: bool(cell(r, 27)),
    prodottoVenduto: str(cell(r, 30)),
    importo: num(cell(r, 31)),
    funnel: funnel
  })).filter(x => x.dataProspect || x.nome);
}

// ────────────────── API DATI ──────────────────

app.get('/api/data', async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: "Non autenticato" });

  try {
    const [rV, rQC, rQuiz, rSales, rAss, rMan] = await Promise.all([
      fetchGviz(TAB_VENDITE).catch(() => null),
      fetchGviz(TAB_QC).catch(() => null),
      fetchGviz(TAB_QUIZ).catch(() => null),
      fetchGviz(TAB_SALES).catch(() => null),
      fetchGviz(TAB_ASSISTENZA).catch(() => null),
      fetchGviz(TAB_MANUALE).catch(() => null)
    ]);

    const vendite = rV ? parseVendite(rV) : [];
    const checkup = [
      ...(rQC ? parseCheckup(rQC, "Queen Challenge") : []),
      ...(rQuiz ? parseCheckup(rQuiz, "Quiz") : []),
      ...(rSales ? parseCheckup(rSales, "Sales") : []),
      ...(rAss ? parseCheckup(rAss, "Assistenza") : []),
      ...(rMan ? parseCheckup(rMan, "Manuale") : [])
    ];

    res.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      vendite,
      checkup,
      config: {
        sheetId: SHEET_ID,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
        funnels: ["Queen Challenge", "Quiz", "Sales", "Assistenza", "Manuale"],
        coaches: [...new Set([
          ...vendite.map(v => v.coach),
          ...checkup.map(c => c.coach)
        ].filter(c => c && String(c).trim() && String(c).trim() !== '0' && String(c).trim().length > 1))].sort()
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ────────────────── STATIC + FALLBACK ──────────────────

app.use(express.static(path.join(__dirname, 'public')));

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sales TV Regina in ascolto su :${PORT}`);
  console.log(`Sheet ID: ${SHEET_ID}`);
  console.log(`Utenti: ${AUTH_USERS.map(u => u.user).join(", ")}`);
});
