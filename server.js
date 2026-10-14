const express = require('express');
const https = require('https');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID || "1rMgXtcmbr-B5byLr9ZC3o54W2BUm8v8My8ZVEsrzTgg";

// URL del Web App Apps Script (POST con {from, to} per modificare celle DA/A nei fogli Sales TV)
// Da configurare in Railway dopo aver deployato scripts/set-period.gs
const SHEETS_WRITE_URL = process.env.SHEETS_WRITE_URL || "";

// Tab names (regex-based lookup lato client-side non serve: qui i nomi esatti con emoji)
const TAB_VENDITE = process.env.TAB_VENDITE || "💅 Vendite Regina";
const TAB_QC = process.env.TAB_QC || "Check-up QC prenotati";
const TAB_QUIZ = process.env.TAB_QUIZ || "Check-up Quiz prenotati";
const TAB_SALES = process.env.TAB_SALES || "Check-up Sales prenotati";
const TAB_ASSISTENZA = process.env.TAB_ASSISTENZA || "Check-up Assistenza prenotati";
const TAB_MANUALE = process.env.TAB_MANUALE || "Check-up Manuale prenotati";

// Fogli dashboard aggregati (letti direttamente, KPI già calcolati)
const TAB_STV_TOTALE = process.env.TAB_STV_TOTALE || "Sales TV TOTALE";
const TAB_STV_QC = process.env.TAB_STV_QC || "Sales TV Queen Challenge";
const TAB_STV_QUIZ = process.env.TAB_STV_QUIZ || "Sales TV Quiz";
const TAB_STV_SALES = process.env.TAB_STV_SALES || "Sales TV Sales";
const TAB_STV_ASSISTENZA = process.env.TAB_STV_ASSISTENZA || "Sales TV Assistenza";
const TAB_STV_MANUALE = process.env.TAB_STV_MANUALE || "Sales TV Manuale";

// Credenziali login (via env)
const AUTH_USERS = (process.env.AUTH_USERS || "info@sofiadigiovanni.com:MetodoRegina1ML").split(",").map(p => {
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
  // Se e' un oggetto Date JS
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  // Formato gviz "Date(YYYY,M,D...)"
  const m = s.match(/Date\((\d+),(\d+),(\d+)/);
  if (m) {
    const y = +m[1];
    const mo = +m[2] + 1;
    const d = +m[3];
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${String(+iso[2]).padStart(2, "0")}-${String(+iso[3]).padStart(2, "0")}`;
  // Italiano dd/mm/yyyy o dd-mm-yyyy o dd.mm.yyyy o dd\mm\yyyy
  const it = s.match(/^(\d{1,2})[\/\-.\\](\d{1,2})[\/\-.\\](\d{2,4})/);
  if (it) {
    const y = it[3].length === 2 ? "20" + it[3] : it[3];
    return `${y}-${String(+it[2]).padStart(2, "0")}-${String(+it[1]).padStart(2, "0")}`;
  }
  // Numero seriale Excel/Sheets (giorni da 1899-12-30)
  const n = Number(s);
  if (!isNaN(n) && n > 30000 && n < 60000) {
    const base = new Date(1899, 11, 30);
    const dt = new Date(base.getTime() + n * 86400000);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }
  // Ultimo tentativo: Date.parse
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
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
// Parse Vendite Regina. Il foglio ha header rows (DA/A/TOTALE/METODO/MCM/ACF/BA/PRODOTTO/COACH)
// seguite da righe vendite reali: A dataVendita, B nome, C cognome, D email, E tel,
// F coach, G prodotto, H importo, I modalita, J Acconto (bool), K Saldo (bool),
// L dataIncasso, M funnel, N note, O dataProspect.
function parseVendite(g) {
  if (!g || !g.table || !g.table.rows) return [];
  const HEADER_NAMES = new Set(['DA','A','PRODOTTO','COACH','TOTALE','METODO','MCM','ACF','BA']);
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
    acconto: bool(cell(r, 9)),
    saldo: bool(cell(r, 10)),
    dataIncasso: gvizDate(cell(r, 11)),
    funnel: str(cell(r, 12)),
    note: str(cell(r, 13)),
    dataProspect: gvizDate(cell(r, 14))
  })).filter(x => {
    // Scarta righe header
    if (HEADER_NAMES.has(String(x.nome || '').toUpperCase())) return false;
    // Scarta righe senza dataVendita valida (o solo nome senza importo)
    if (!x.dataVendita && !x.importo) return false;
    return true;
  });
}

// Parse Sales TV TOTALE (dashboard aggregato)
// Row 0: DA | <data> | row 1: A | <data> | row 4: TOTALE data | row 5+: coach data
// Columns indici 0-based: 1=COACH, 2=OBIETTIVO, 3=FATT.PER CASSA, 4=FATT.MESE PREC,
// 5=FATT.X COMP, 7=IDEAL, 8=OBIETTIVO SETTIMANALE, 9=ROP, 10=OBIETTIVO ROP,
// 11=PROSPECT ASSEGNATI, 12=CHIAMATI, 13=CHECK-UP, 14=% CHECK-UP, 15=VENDITE,
// 17=%CONV, 21=SCOSTAMENTO
function parseSalesTV(g) {
  if (!g || !g.table || !g.table.rows) return null;
  const rows = g.table.rows;
  const dateFrom = gvizDate(cell(rows[0], 2));
  const dateTo = gvizDate(cell(rows[1], 2));

  function rowToKpi(row) {
    if (!row) return null;
    const name = str(cell(row, 1));
    if (!name || /^=/.test(name) || /\|/.test(name)) return null;
    return {
      name,
      obiettivo: num(cell(row, 2)) || 10000,
      fattPerCassa: num(cell(row, 3)),
      fattMesePrec: num(cell(row, 4)),
      fattXComp: num(cell(row, 5)),
      ideal: num(cell(row, 7)),
      obiettivoSettimanale: num(cell(row, 8)),
      rop: num(cell(row, 9)),
      obiettivoRop: num(cell(row, 10)),
      prospectAssegnati: num(cell(row, 11)),
      chiamati: num(cell(row, 12)),
      checkup: num(cell(row, 13)),
      pctCheckup: num(cell(row, 14)),
      vendite: num(cell(row, 15)),
      pctConv: num(cell(row, 17)),
      scostamento: num(cell(row, 21))
    };
  }

  // Row 4 = TOTALE, Row 5+ = coaches
  const totale = rowToKpi(rows[4]);
  const coaches = [];
  for (let i = 5; i < rows.length; i++) {
    const k = rowToKpi(rows[i]);
    if (k && k.name && k.name.toUpperCase() !== 'TOTALE') coaches.push(k);
  }

  return { dateFrom, dateTo, totale, coaches };
}

// Parse Sales TV per singolo canale (struttura diversa dal TOTALE)
// Row 0: DA | row 1: A | row 2: COACH header | row 3: TOTALE | row 4+: coach data
// Columns: 1=COACH, 3=FATT.MESE PREC, 4=FATT.PER CASSA, 5=PROSPECT ASSEGNATI,
// 6=CHIAMATI, 7=CHECK-UP, 8=% CHECK-UP, 9=VENDITE, 10=%CONV,
// 11=€X? 12=€Y? 13=€Z? 14=ROP (1.048€), 15=SCOSTAMENTO (1.397€)
function parseSalesTVCanale(g) {
  if (!g || !g.table || !g.table.rows) return null;
  const rows = g.table.rows;
  const dateFrom = gvizDate(cell(rows[0], 2));
  const dateTo = gvizDate(cell(rows[1], 2));

  function rowToKpi(row) {
    if (!row) return null;
    const name = str(cell(row, 1));
    if (!name || /^=/.test(name) || /\|/.test(name) || name.toUpperCase() === 'COACH') return null;
    return {
      name,
      fattMesePrec: num(cell(row, 3)),
      fattPerCassa: num(cell(row, 4)),
      prospectAssegnati: num(cell(row, 5)),
      chiamati: num(cell(row, 6)),
      checkup: num(cell(row, 7)),
      pctCheckup: num(cell(row, 8)),
      vendite: num(cell(row, 9)),
      pctConv: num(cell(row, 10)),
      rop: num(cell(row, 14)),
      scostamento: num(cell(row, 15))
    };
  }

  // Scansione: trova la prima riga con name=="TOTALE" e poi successive
  let totale = null;
  const coaches = [];
  for (let i = 0; i < rows.length; i++) {
    const k = rowToKpi(rows[i]);
    if (!k) continue;
    if (k.name.toUpperCase() === 'TOTALE') { totale = k; continue; }
    if (totale) coaches.push(k);
  }

  return { dateFrom, dateTo, totale, coaches };
}

// Parse check-up: A=Data compilazione, B=Nome, C=Cognome, D=Telefono, E=Email,
// R=Coach (17), S=SETTING (18), X=DATA CHECK-UP (23), Y=CHECK UP (24),
// AB=VENDUTO (27), AF=PROD VEND (31), AG=IMPORTO (32)
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
    prodottoVenduto: str(cell(r, 31)),
    importo: num(cell(r, 32)),
    funnel: funnel
  })).filter(x => x.dataProspect || x.nome);
}

// ────────────────── API DATI ──────────────────

app.get('/api/data', async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: "Non autenticato" });

  try {
    const [
      rV, rQC, rQuiz, rSales, rAss, rMan,
      rStvTot, rStvQC, rStvQuiz, rStvSales, rStvAss, rStvMan
    ] = await Promise.all([
      fetchGviz(TAB_VENDITE).catch(() => null),
      fetchGviz(TAB_QC).catch(() => null),
      fetchGviz(TAB_QUIZ).catch(() => null),
      fetchGviz(TAB_SALES).catch(() => null),
      fetchGviz(TAB_ASSISTENZA).catch(() => null),
      fetchGviz(TAB_MANUALE).catch(() => null),
      fetchGviz(TAB_STV_TOTALE).catch(() => null),
      fetchGviz(TAB_STV_QC).catch(() => null),
      fetchGviz(TAB_STV_QUIZ).catch(() => null),
      fetchGviz(TAB_STV_SALES).catch(() => null),
      fetchGviz(TAB_STV_ASSISTENZA).catch(() => null),
      fetchGviz(TAB_STV_MANUALE).catch(() => null)
    ]);

    const vendite = rV ? parseVendite(rV) : [];
    const checkup = [
      ...(rQC ? parseCheckup(rQC, "Queen Challenge") : []),
      ...(rQuiz ? parseCheckup(rQuiz, "Quiz") : []),
      ...(rSales ? parseCheckup(rSales, "Sales") : []),
      ...(rAss ? parseCheckup(rAss, "Assistenza") : []),
      ...(rMan ? parseCheckup(rMan, "Manuale") : [])
    ];

    const salesTV = {
      totale: rStvTot ? parseSalesTV(rStvTot) : null,
      canali: {
        "Queen Challenge": rStvQC   ? parseSalesTVCanale(rStvQC)   : null,
        "Quiz":            rStvQuiz ? parseSalesTVCanale(rStvQuiz) : null,
        "Sales":           rStvSales? parseSalesTVCanale(rStvSales): null,
        "Assistenza":      rStvAss  ? parseSalesTVCanale(rStvAss)  : null,
        "Manuale":         rStvMan  ? parseSalesTVCanale(rStvMan)  : null
      }
    };

    // Coaches: prima dai Sales TV TOTALE (fonte autorevole), fallback vendite/checkup
    let coaches = [];
    if (salesTV.totale && salesTV.totale.coaches && salesTV.totale.coaches.length) {
      coaches = salesTV.totale.coaches.map(c => c.name).filter(Boolean);
    } else {
      coaches = [...new Set([
        ...vendite.map(v => v.coach),
        ...checkup.map(c => c.coach)
      ].filter(c => {
        const s = String(c || '').trim();
        if (!s) return false;
        if (/^[0-9]+$/.test(s)) return false;
        if (s.toUpperCase() === 'TRUE' || s.toUpperCase() === 'FALSE') return false;
        return true;
      }))].sort();
    }

    res.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      vendite,
      checkup,
      salesTV,
      config: {
        sheetId: SHEET_ID,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
        funnels: ["Queen Challenge", "Quiz", "Sales", "Assistenza", "Manuale"],
        coaches
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ────────────────── SET PERIOD (scrive celle DA/A nei fogli Sales TV) ──────────────────

function postJson(url, body, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    function fetchGet(targetUrl, redirects) {
      const u = new URL(targetUrl);
      https.get({ hostname: u.hostname, path: u.pathname + u.search }, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          if (redirects <= 0) return reject(new Error('Troppi redirect (GET)'));
          r.resume();
          return fetchGet(new URL(r.headers.location, targetUrl).toString(), redirects - 1);
        }
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve({ status: r.statusCode, body: d }));
      }).on('error', reject);
    }

    // Apps Script Web App: POST sul /macros/s/.../exec, poi 302 → googleusercontent.com
    // Il redirect va seguito come GET (il body del POST è stato già processato dal primo endpoint).
    const u = new URL(url);
    const opts = {
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(opts, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return fetchGet(new URL(r.headers.location, url).toString(), maxRedirects);
      }
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

app.post('/api/set-period', async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: "Non autenticato" });
  const from = String(req.body.from || "");
  const to = String(req.body.to || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ ok: false, error: "Date non valide (YYYY-MM-DD)" });
  }
  if (!SHEETS_WRITE_URL) {
    return res.status(503).json({
      ok: false,
      error: "SHEETS_WRITE_URL non configurato. Deploya scripts/set-period.gs come Web App e metti l'URL nelle env Railway."
    });
  }
  try {
    const result = await postJson(SHEETS_WRITE_URL, { from, to, sheetId: SHEET_ID });
    if (result.status >= 400) {
      return res.status(502).json({ ok: false, error: `Apps Script HTTP ${result.status}: ${result.body.slice(0, 200)}` });
    }
    // Attesa breve per permettere al foglio di ricalcolare le formule
    await new Promise(r => setTimeout(r, 1500));
    res.json({ ok: true, from, to, appsScript: result.body.slice(0, 300) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ────────────────── DEBUG (per troubleshoot) ──────────────────

app.get('/api/debug', async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false });
  try {
    const [rV, rQC] = await Promise.all([
      fetchGviz(TAB_VENDITE).catch(e => ({ err: e.message })),
      fetchGviz(TAB_QC).catch(e => ({ err: e.message }))
    ]);
    // Prendi le prime 3 righe raw per ispezione
    const vRows = rV && rV.table && rV.table.rows ? rV.table.rows.slice(0, 3) : [];
    const qcRows = rQC && rQC.table && rQC.table.rows ? rQC.table.rows.slice(0, 3) : [];
    const vendite = rV ? parseVendite(rV) : [];
    const checkup = rQC ? parseCheckup(rQC, 'Queen Challenge') : [];
    res.json({
      ok: true,
      sheetId: SHEET_ID,
      tabs: { vendite: TAB_VENDITE, qc: TAB_QC },
      raw: { venditeRows: vRows, qcRows: qcRows },
      parsed: {
        venditeCount: vendite.length,
        venditeFirst3: vendite.slice(0, 3),
        checkupCount: checkup.length,
        checkupFirst3: checkup.slice(0, 3)
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ────────────────── DEBUG: scan tab list (gid + name) ──────────────────
// Il foglio pubblico non espone i nomi tab via JSON API senza autenticazione.
// Workaround: fetchiamo l'HTML view del foglio e cerchiamo i tag <option> con gid.
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: {'User-Agent': 'Mozilla/5.0'} }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return fetchText(new URL(r.headers.location, url).toString()).then(resolve, reject);
      }
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    }).on('error', reject);
  });
}

app.get('/api/tabs', async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false });
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`;
    const resp = await fetchText(url);
    const html = resp.body || '';
    const found = [];
    const seen = new Set();
    // Tanti pattern diversi per robustezza (Google cambia frequentemente il formato dell'htmlview)
    // Google htmlview injetta items.push({name: "...", pageUrl: "...gid=NNN", gid: NNN, index: ...})
    // Parse manuale: trovo ogni "items.push({name:" e poi scorro per name e gid.
    let idxP = 0;
    while ((idxP = html.indexOf('items.push({name:', idxP)) !== -1) {
      const nStart = html.indexOf('"', idxP) + 1;
      const nEnd = html.indexOf('"', nStart);
      if (nStart < 1 || nEnd < 0) { idxP += 20; continue; }
      const name = html.slice(nStart, nEnd);
      // Cerca ", gid:" dopo nEnd fino al prossimo "items.push" o 1000 char
      const nextPush = html.indexOf('items.push', nEnd);
      const limit = nextPush === -1 ? nEnd + 1500 : nextPush;
      const gidMatch = html.slice(nEnd, limit).match(/,\s*gid:\s*"?(-?\d+)"?/);
      if (gidMatch) {
        const gid = gidMatch[1];
        if (!seen.has(gid)) {
          seen.add(gid);
          found.push({ name, gid });
        }
      }
      idxP = nEnd + 1;
    }
    // Snippet HTML per debug: trova 3 occorrenze di "gid"
    const idx = html.indexOf('gid');
    const snippet = idx >= 0 ? html.slice(Math.max(0, idx - 50), idx + 300) : null;
    const debug = {
      hasItemsPush: html.indexOf('items.push') !== -1,
      firstItemsPushPos: html.indexOf('items.push'),
      itemsPushContextRaw: null,
      gidPos: html.indexOf(', gid:'),
      gidContextRaw: null
    };
    if (debug.firstItemsPushPos >= 0) {
      debug.itemsPushContextRaw = html.slice(debug.firstItemsPushPos, debug.firstItemsPushPos + 400);
    }
    if (debug.gidPos >= 0) {
      debug.gidContextRaw = html.slice(debug.gidPos, debug.gidPos + 50);
      debug.gidCharCodes = Array.from(html.slice(debug.gidPos, debug.gidPos + 20)).map(c => c.charCodeAt(0));
    }
    res.json({ ok: true, status: resp.status, count: found.length, tabs: found, htmlSize: html.length, snippet, debug });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Legge una tab Vendite via GID esplicito (debug)
app.get('/api/vendite-by-gid/:gid', async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false });
  try {
    const gid = String(req.params.gid).replace(/[^0-9]/g, '');
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}&range=A1:O2000`;
    const resp = await fetchText(url);
    const match = resp.body.match(/\{[\s\S]*\}/);
    if (!match) return res.json({ ok: false, status: resp.status, error: 'no-json', snippet: resp.body.slice(0, 300) });
    const j = JSON.parse(match[0]);
    const rows = j.table && j.table.rows ? j.table.rows : [];
    const sample = rows.slice(0, 10).map(r => ({
      A: r.c[0]?.f || r.c[0]?.v,
      B: r.c[1]?.v,
      C: r.c[2]?.v,
      G: r.c[6]?.v,
      H: r.c[7]?.v,
      I: r.c[8]?.v,
      J: r.c[9]?.v,
      K: r.c[10]?.v
    }));
    res.json({ ok: true, gid, totalRows: rows.length, cols: (j.table.cols||[]).length, sample });
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
