// ═══════════ SALES TV — Metodo Regina ═══════════

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const OBIETTIVO_COACH = 10000; // per coach al mese

const CHANNEL_META = {
  'Queen Challenge': { icon: '👑' },
  'Quiz': { icon: '❓' },
  'Sales': { icon: '📞' },
  'Assistenza': { icon: '💬' },
  'Manuale': { icon: '📖' }
};

const state = {
  data: null,
  period: "sheet", // sheet = usa il periodo del foglio, altrimenti sincronizza
  dateFrom: null,
  dateTo: null,
  activeTab: 'home',
  coachSubView: 'stats',
  currentUser: null,
  periodBusy: false
};

const COACH_SUBVIEWS = [
  { id: 'stats',         label: 'Statistiche',    num: 1  },
  { id: 'calendario',    label: 'Calendario',     num: 2  },
  { id: 'contatti',      label: 'Contatti',       num: 3  },
  { id: 'da-chiamare',   label: 'Da chiamare',    num: 4  },
  { id: 'no-risp',       label: 'No risp.',       num: 5  },
  { id: 'sospesi',       label: 'Sospesi',        num: 6  },
  { id: 'checkup',       label: 'Check-up',       num: 7  },
  { id: 'follow-up',     label: 'Follow-up',      num: 8  },
  { id: 'da-risentire',  label: 'Da risentire',   num: 9  },
  { id: 'vendite',       label: 'Vendite',        num: 10 },
  { id: 'da-pagare',     label: 'Da pagare',      num: 11 },
  { id: 'persi',         label: 'Persi',          num: 12 },
  { id: 'registrazioni', label: 'Registrazioni',  num: 13 }
];

// ─────────────── DOM helpers ───────────────

function showApp() {
  $('#login').style.display = 'none';
  $('#login').hidden = true;
  $('#app').style.display = '';
  $('#app').hidden = false;
}
function showLogin() {
  $('#login').style.display = '';
  $('#login').hidden = false;
  $('#app').style.display = 'none';
  $('#app').hidden = true;
}

// ─────────────── AUTH ───────────────

async function checkAuth() {
  try {
    const r = await fetch('/api/me', { credentials: 'include' });
    if (!r.ok) throw 0;
    const d = await r.json();
    return d.user;
  } catch { return null; }
}
async function doLogin(email, pass) {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password: pass })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Login fallito');
  return d.user;
}
async function doLogout() {
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  location.reload();
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  e.stopPropagation();
  $('#loginError').textContent = '';
  try {
    const u = await doLogin($('#loginEmail').value, $('#loginPass').value);
    state.currentUser = u;
    showApp();
    await fetchData();
    render();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
  return false;
});

// ─────────────── FORGOT PASSWORD MODAL ───────────────
const forgotLink = document.getElementById('forgotLink');
const forgotModal = document.getElementById('forgotModal');
const forgotClose = document.getElementById('forgotClose');
if (forgotLink && forgotModal) {
  forgotLink.addEventListener('click', e => {
    e.preventDefault();
    forgotModal.hidden = false;
  });
  forgotClose.addEventListener('click', () => { forgotModal.hidden = true; });
  forgotModal.addEventListener('click', e => {
    if (e.target === forgotModal) forgotModal.hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !forgotModal.hidden) forgotModal.hidden = true;
  });
}

// ─────────────── DATA ───────────────

async function fetchData() {
  const r = await fetch('/api/data', { credentials: 'include' });
  if (!r.ok) { toast('Errore caricamento dati', 'error'); throw new Error('fetch fail'); }
  const d = await r.json();
  state.data = d;
  updateSubtitle();
  toast(`Dati aggiornati · ${d.vendite.length} vendite · ${d.checkup.length} check-up`);
}

function updateSubtitle() {
  const el = document.getElementById('pageSubtitle');
  if (!el || !state.data || !state.data.updatedAt) return;
  const d = new Date(state.data.updatedAt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  el.textContent = `Foglio letto alle ${hh}:${mm}`;
}

// ─────────────── DATE ───────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function firstOfWeekISO(offset = 0) {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - day + offset * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function firstOfMonthISO(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function lastOfMonthISO(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset + 1);
  d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computePeriodRange() {
  const today = todayISO();
  switch (state.period) {
    case 'thisMonth': return [firstOfMonthISO(0), lastOfMonthISO(0)];
    case 'thisWeek': return [firstOfWeekISO(0), today];
    case 'lastMonth': return [firstOfMonthISO(-1), lastOfMonthISO(-1)];
    case 'ytd': return [`${new Date().getFullYear()}-01-01`, today];
    case 'all': return ['1970-01-01', '9999-12-31'];
    case 'custom': return [state.dateFrom || '1970-01-01', state.dateTo || '9999-12-31'];
    case 'sheet': {
      const sp = sheetPeriod();
      return sp ? [sp.from, sp.to] : [firstOfMonthISO(0), lastOfMonthISO(0)];
    }
    default: return [firstOfMonthISO(0), lastOfMonthISO(0)];
  }
}

// Calcola [from, to] in base al pill cliccato (indipendente da state.period)
function periodFromPill(id) {
  const today = todayISO();
  const Y = new Date().getFullYear();
  switch (id) {
    case 'thisMonth': return [firstOfMonthISO(0), lastOfMonthISO(0)];
    case 'thisWeek':  return [firstOfWeekISO(0), today];
    case 'lastMonth': return [firstOfMonthISO(-1), lastOfMonthISO(-1)];
    case 'ytd':      return [`${Y}-01-01`, `${Y}-12-31`]; // Quest'anno = anno intero (per obiettivo annuo)
    default:         return null;
  }
}

// Invia POST al backend per modificare le celle DA/A del foglio, poi re-fetch dati
async function applyPeriodToSheet(from, to) {
  if (state.periodBusy) return;
  state.periodBusy = true;
  showPeriodStatus('⏳ Aggiornando il foglio…', 'busy');
  try {
    const r = await fetch('/api/set-period', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to })
    });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      showPeriodStatus('⚠️ ' + (j.error || 'Errore aggiornando il foglio'), 'error');
      state.periodBusy = false;
      return false;
    }
    await fetchData();
    render();
    showPeriodStatus('✓ Periodo aggiornato', 'ok');
    setTimeout(() => showPeriodStatus('', 'hide'), 2500);
    state.periodBusy = false;
    return true;
  } catch (e) {
    showPeriodStatus('⚠️ ' + e.message, 'error');
    state.periodBusy = false;
    return false;
  }
}

function showPeriodStatus(msg, kind) {
  const el = document.getElementById('periodStatus');
  if (!el) return;
  if (kind === 'hide' || !msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = msg;
  el.className = 'period-status ' + (kind || '');
}
function inRange(dateStr, from, to) {
  // Modalita "sempre": accetta anche righe senza data (per non perdere record con date malformate)
  if (from === '1970-01-01' && to === '9999-12-31') return true;
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

// ─────────────── AGGREGATION ───────────────

// Deriva vendite dai check-up con venduto=true (fonte di verita)
function venditeDaCheckup(coach) {
  const cu = state.data.checkup.filter(c => c.venduto && c.importo > 0);
  return cu
    .filter(c => !coach || coach === '__ALL__' || c.coach === coach)
    .map(c => ({
      // Data vendita = DATA CHECK-UP (col X), fallback a dataProspect
      dataVendita: c.dataCheckup || c.dataProspect,
      dataIncasso: c.dataCheckup || c.dataProspect, // stessa data (semplice)
      dataProspect: c.dataProspect,
      nome: c.nome, cognome: c.cognome,
      email: c.email, telefono: c.telefono,
      coach: c.coach || 'Sofia',
      prodotto: c.prodottoVenduto,
      importo: c.importo,
      funnel: c.funnel
    }));
}

// Fetch KPI dalla riga Sales TV TOTALE (coach=null → TOTALE, coach="Sofia" → Sofia)
function stvRow(coach) {
  const stv = state.data && state.data.salesTV && state.data.salesTV.totale;
  if (!stv) return null;
  if (!coach) return stv.totale || null;
  return (stv.coaches || []).find(c => c.name === coach) || null;
}

function stvCanaleRow(canale, coach) {
  const stv = state.data && state.data.salesTV && state.data.salesTV.canali && state.data.salesTV.canali[canale];
  if (!stv) return null;
  if (!coach) return stv.totale || null;
  return (stv.coaches || []).find(c => c.name === coach) || null;
}

// Periodo dichiarato nel foglio Sales TV TOTALE (celle DA/A)
function sheetPeriod() {
  const stv = state.data && state.data.salesTV && state.data.salesTV.totale;
  if (!stv || !stv.dateFrom || !stv.dateTo) return null;
  return { from: stv.dateFrom, to: stv.dateTo };
}

function aggregateFor(coach) {
  if (!state.data) return null;

  // Priorità al periodo del foglio Sales TV (è lì che l'utente imposta DA/A)
  const sp = sheetPeriod();
  const [from, to] = sp ? [sp.from, sp.to] : computePeriodRange();
  const [prevFrom, prevTo] = shiftRange(from, to, -1);

  // Dati raw dai check-up (per percorso/non-chiusi/liste venditore)
  const vendite = venditeDaCheckup(coach);
  let checkup = state.data.checkup;
  if (coach && coach !== '__ALL__') {
    checkup = checkup.filter(c => c.coach === coach);
  }
  const vendPeriod = vendite.filter(v => inRange(v.dataVendita, from, to));
  const incPeriod = vendite.filter(v => inRange(v.dataIncasso, from, to));
  const cuProspect = checkup.filter(c => inRange(c.dataProspect, from, to));
  const cuFatti = checkup.filter(c => inRange(c.dataCheckup, from, to) && String(c.checkupStato).toUpperCase() === 'FATTO');
  const chiamati = checkup.filter(c => inRange(c.dataProspect, from, to) && c.setting);

  const vendPrev = vendite.filter(v => inRange(v.dataVendita, prevFrom, prevTo));
  const incPrev = vendite.filter(v => inRange(v.dataIncasso, prevFrom, prevTo));
  const fattPrev = vendPrev.reduce((a, v) => a + v.importo, 0);
  const incPrev_ = incPrev.reduce((a, v) => a + v.importo, 0);

  // KPI PRIMARI: letti dal foglio Sales TV TOTALE (fonte autorevole, già aggregata)
  const stv = stvRow(coach);
  let fatt, inc, prospect, nCheckup, nVendite, rop, ropTarget, roc, obiettivo, ideal;
  if (stv) {
    fatt = stv.fattPerCassa || 0;
    inc = stv.fattPerCassa || 0; // il foglio non distingue; "incassato" è il fatturato per cassa
    prospect = stv.prospectAssegnati || 0;
    nCheckup = stv.checkup || 0;
    nVendite = stv.vendite || 0;
    rop = stv.rop || 0;
    ropTarget = stv.obiettivoRop || 400;
    roc = stv.chiamati ? Math.round(fatt / stv.chiamati) : 0;
    obiettivo = stv.obiettivo || OBIETTIVO_COACH;
    ideal = stv.ideal || 0;
  } else {
    // Fallback a calcoli locali (se foglio non disponibile)
    fatt = vendPeriod.reduce((a, v) => a + v.importo, 0);
    inc = incPeriod.reduce((a, v) => a + v.importo, 0);
    prospect = cuProspect.length;
    nCheckup = cuFatti.length;
    nVendite = vendPeriod.length;
    rop = prospect ? Math.round(fatt / prospect) : 0;
    ropTarget = 400;
    roc = chiamati.length ? Math.round(fatt / chiamati.length) : 0;
    obiettivo = OBIETTIVO_COACH;
    ideal = 0;
  }

  const daLeadPrecedenti = vendite.filter(v => inRange(v.dataProspect, prevFrom, prevTo) && inRange(v.dataIncasso, from, to)).reduce((a, v) => a + v.importo, 0);

  return {
    from, to,
    vendPeriod, incPeriod, cuProspect, cuFatti, chiamati,
    fatt, inc, fattPrev, incPrev: incPrev_, daLeadPrecedenti,
    trendFatt: fattPrev ? ((fatt - fattPrev) / fattPrev) * 100 : 0,
    trendInc: incPrev_ ? ((inc - incPrev_) / incPrev_) * 100 : 0,
    prospect,
    vendite: nVendite,
    checkup: nCheckup,
    chiamatiCount: stv ? (stv.chiamati || 0) : chiamati.length,
    ticketMedio: nVendite ? fatt / nVendite : 0,
    rop,
    ropTarget,
    roc,
    rocu: nCheckup ? Math.round(fatt / nCheckup) : 0,
    obiettivo,
    ideal,
    stv // la riga Sales TV grezza (null se foglio non caricato)
  };
}

function shiftRange(from, to, offsetMonths) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const nf = new Date(fy, fm - 1 + offsetMonths, fd);
  const nt = new Date(ty, tm - 1 + offsetMonths, td);
  return [
    `${nf.getFullYear()}-${String(nf.getMonth() + 1).padStart(2, '0')}-${String(nf.getDate()).padStart(2, '0')}`,
    `${nt.getFullYear()}-${String(nt.getMonth() + 1).padStart(2, '0')}-${String(nt.getDate()).padStart(2, '0')}`
  ];
}

function activeCoaches() {
  if (!state.data) return [];
  // Priorità alla lista venditori del foglio Sales TV TOTALE (ordinata come il foglio)
  if (state.data.config && state.data.config.coaches && state.data.config.coaches.length) {
    return state.data.config.coaches.slice();
  }
  const set = new Set();
  state.data.checkup.forEach(c => {
    const s = String(c.coach || '').trim();
    if (!s) return;
    if (/^[0-9]+$/.test(s)) return;
    if (s.toUpperCase() === 'TRUE' || s.toUpperCase() === 'FALSE') return;
    set.add(s);
  });
  return [...set].sort();
}

// ─────────────── FORMAT ───────────────

const fmtEur = v => '€ ' + new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Math.round(v || 0));
const fmtEurShort = v => '€ ' + new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Math.round(v || 0));
const fmtNum = v => new Intl.NumberFormat('it-IT').format(v || 0);
const fmtPct = v => (v || 0).toFixed(1) + '%';
const fmtPctInt = v => Math.round(v || 0) + '%';
const fmtDate = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

function trendChip(pct) {
  if (!isFinite(pct) || pct === 0) return '';
  const cls = pct > 0 ? 'trend-up' : 'trend-down';
  const arrow = pct > 0 ? '▲' : '▼';
  return `<span class="trend-chip ${cls}">${arrow} ${Math.abs(pct).toFixed(0)}%</span>`;
}

// Proietta il fatturato a fine mese basandosi sul ritmo del periodo corrente.
// Se il periodo copre tutto il mese corrente, usa i giorni passati; altrimenti
// prende la lunghezza del periodo richiesto come proxy.
function proiezioneFineMese(fatt, fromISO, toISO) {
  if (!fatt || !toISO) return 0;
  const now = new Date();
  const [ty, tm, td] = toISO.split('-').map(Number);
  const [fy, fm, fd] = (fromISO || toISO).split('-').map(Number);
  const toDate = new Date(ty, tm - 1, td);
  const fromDate = new Date(fy, fm - 1, fd);
  // Fine del mese del periodo "A"
  const endOfMonth = new Date(ty, tm, 0);
  // Giorni "coperti" dal periodo (max fino a oggi se la fine è nel futuro)
  const effectiveEnd = toDate > now ? now : toDate;
  const dayDiff = Math.max(1, Math.round((effectiveEnd - fromDate) / 86400000) + 1);
  // Giorni totali dal from alla fine del mese
  const totalDays = Math.max(dayDiff, Math.round((endOfMonth - fromDate) / 86400000) + 1);
  return (fatt / dayDiff) * totalDays;
}

// ─────────────── DONUT SVG ───────────────

function donutSVG(pct, size = 180) {
  const clamped = Math.max(0, Math.min(pct, 100));
  const r = (size / 2) - 10;
  const c = 2 * Math.PI * r;
  const off = c - (c * clamped / 100);
  return `
    <svg viewBox="0 0 ${size} ${size}">
      <circle class="track" cx="${size/2}" cy="${size/2}" r="${r}"></circle>
      <circle class="value" cx="${size/2}" cy="${size/2}" r="${r}"
        stroke-dasharray="${c}" stroke-dashoffset="${off}"></circle>
    </svg>
  `;
}

// ─────────────── RENDER ───────────────

function render() {
  if (!state.data) return;
  renderTabs();
  renderContent();
  updatePeriodChip();
}

function renderTabs() {
  const coaches = activeCoaches();
  const tabs = [
    { id: 'home', label: '🏠 Home' },
    ...coaches.map(c => ({ id: 'coach:' + c, label: c, badge: null, avatar: c[0].toUpperCase() })),
    { id: 'copy', label: '📝 Copy TV' }
  ];
  $('#tabs').innerHTML = tabs.map(t => `
    <button class="tab ${state.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
      ${t.avatar ? `<span class="tab-avatar">${t.avatar}</span>` : ''}
      <span>${t.label}</span>
      ${t.badge ? `<span class="tab-badge">${t.badge}</span>` : ''}
    </button>
  `).join('');
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    if (state.activeTab !== b.dataset.tab) state.coachSubView = 'stats';
    state.activeTab = b.dataset.tab;
    render();
  }));
}

function renderContent() {
  const isHome = state.activeTab === 'home';
  const isCopy = state.activeTab === 'copy';
  const coach = isHome || isCopy ? null : state.activeTab.replace('coach:', '');
  let html;
  if (isHome) html = renderHome();
  else if (isCopy) html = renderCopyTV();
  else html = renderCoachDetail(coach);
  $('#viewContent').innerHTML = html;
  bindContent();
}

// Conta i mesi distinti nel range [from, to] (es. 2026-01-01 → 2026-12-31 = 12)
function monthsInRange(from, to) {
  if (!from || !to) return 1;
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const n = (ty * 12 + tm) - (fy * 12 + fm) + 1;
  return Math.max(1, n);
}

function renderHome() {
  const agg = aggregateFor(null);
  const coaches = activeCoaches();
  const nMesi = monthsInRange(agg.from, agg.to);
  // Obiettivo team = somma degli obiettivi mensili dei coach × numero mesi nel periodo
  const obiettivoMensile = coaches.reduce((s, c) => {
    const a = aggregateFor(c);
    return s + (a && a.obiettivo ? a.obiettivo : OBIETTIVO_COACH);
  }, 0) || (agg.obiettivo || OBIETTIVO_COACH);
  const totObiettivo = obiettivoMensile * nMesi;
  const pctObj = totObiettivo ? (agg.fatt / totObiettivo) * 100 : 0;
  const mancano = Math.max(0, totObiettivo - agg.fatt);
  const [ , to] = agg.from ? [agg.from, agg.to] : ['', ''];
  const dayEnd = to.split('-')[2];
  const monthName = new Date(agg.to).toLocaleDateString('it-IT', { month: 'long' });
  const stimaVendite = agg.ticketMedio ? Math.ceil(mancano / agg.ticketMedio) : 0;

  // Barre ROP per coach
  const coachRop = coaches.map(c => {
    const a = aggregateFor(c);
    return { coach: c, rop: a.rop, target: a.ropTarget };
  });
  const ropMax = Math.max(600, ...coachRop.map(x => x.rop));

  const teamNames = coaches.slice(0, 2).join(' + ');

  return `
    <!-- SEZIONE 1: IL TEAM NEL PERIODO -->
    <section>
      <div class="section-label">Obiettivo</div>
      <div class="section-title">Il team nel periodo</div>
      <div class="section-sub">${teamNames || 'Team vendita'}</div>
      <div class="section-legend">
        <span><span class="dot" style="background:#eab308"></span>ROP (resa per contatto)</span>
        <span><span class="dot" style="background:#06b6d4"></span>ROCU (resa per check-up)</span>
        <span><span class="dot" style="background:#10b981"></span>Fatturato e vendite</span>
        <span><span class="dot" style="background:#2dd4bf"></span>Incassato</span>
        <span><span class="dot" style="background:#f97316"></span>Contatti</span>
        <span><span class="dot" style="background:#a855f7"></span>Check-up</span>
        <span><span class="dot" style="background:#ec4899"></span>Non chiusi</span>
      </div>

      <div class="team-grid">
        <div class="team-card">
          <div class="donut donut-lg">
            ${donutSVG(pctObj)}
            <div class="donut-center">
              <div class="donut-label">Fatturato</div>
              <div class="donut-value donut-value-eur">${fmtEur(agg.fatt)}</div>
              <div class="donut-sub">${fmtPctInt(pctObj)} di ${fmtEur(totObiettivo)}</div>
            </div>
          </div>
          <div class="team-info">
            <div class="info-sub-top">Per l'obiettivo mancano <b>${fmtEur(mancano)}</b>, circa <b>${stimaVendite} vendite</b></div>
            ${(() => {
              const proj = proiezioneFineMese(agg.fatt, agg.from, agg.to);
              if (!proj) return '<div class="info-hint">dove si arriva oggi a ritmo costante</div>';
              const pctProj = totObiettivo ? (proj / totObiettivo) * 100 : 0;
              const good = pctProj >= 100;
              return `
                <div class="se-continua-box ${good ? 'ok' : 'warn'}" style="margin-top:12px">
                  <div class="se-continua-label">Se continuate così</div>
                  <div class="se-continua-value">${fmtEur(proj)}</div>
                  <div class="se-continua-sub">a fine mese · <b>${fmtPctInt(pctProj)}</b> dell'obiettivo</div>
                </div>
                <div class="info-hint" style="margin-top:10px">dove si arriva oggi a ritmo costante</div>
              `;
            })()}
          </div>
        </div>

        <div class="rop-card">
          <div class="rop-header">ROP · Resa per contatto</div>
          <div class="rop-main">
            <div class="rop-value">${fmtEur(agg.rop)}</div>
            ${trendChip(agg.rop && agg.ropTarget ? ((agg.rop - agg.ropTarget) / agg.ropTarget) * 100 : 0)}
          </div>
          <div class="rop-sub">${fmtEur(agg.fatt)} di fatturato su ${agg.prospect} contatti · obiettivo <b>${fmtEur(agg.ropTarget)}</b></div>
          <div class="rop-bars">
            ${coachRop.map((x, i) => {
              const w = Math.min(100, (x.rop / ropMax) * 100);
              const targetW = (x.target / ropMax) * 100;
              const color = i === 0 ? '#3b82f6' : '#f97316';
              return `
                <div class="rop-bar-row">
                  <div class="rop-bar-name"><span class="dot" style="background:${color}"></span>${x.coach}</div>
                  <div class="rop-bar-track">
                    <div class="rop-bar-fill" style="width:${w}%"></div>
                    <div class="rop-bar-target" style="left:${targetW}%"></div>
                  </div>
                  <div class="rop-bar-value">${fmtEur(x.rop)}</div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="rop-note">La linea bianca è l'obiettivo di ${fmtEur(agg.ropTarget)} per contatto. Somma di tutto il fatturato diviso i contatti di Queen Challenge, Quiz, Sales, Assistenza e Manuale.</div>
          <div class="roc-badges">
            <div class="roc-badge">
              <div class="roc-label">ROC</div>
              <div class="roc-value">${fmtEur(agg.roc)}</div>
              <div class="roc-sub">per chiamato</div>
            </div>
            <div class="roc-badge roc-badge-rocu">
              <div class="roc-label">ROCU</div>
              <div class="roc-value">${fmtEur(agg.rocu)}</div>
              <div class="roc-sub">per check-up · ${agg.checkup}</div>
            </div>
          </div>
          <!-- ROCU · Resa per check-up (team) -->
          <div class="rocu-section">
            <div class="rocu-header">ROCU · Resa per check-up</div>
            <div class="rocu-bars">
              ${coaches.map((c, i) => {
                const a = aggregateFor(c);
                const rocu = a.checkup ? Math.round(a.fatt / a.checkup) : 0;
                const rocuMax = Math.max(1500, ...coaches.map(cc => {
                  const aa = aggregateFor(cc);
                  return aa.checkup ? aa.fatt / aa.checkup : 0;
                }));
                const w = Math.min(100, (rocu / rocuMax) * 100);
                const color = i === 0 ? '#06b6d4' : '#f97316';
                return `
                  <div class="rop-bar-row">
                    <div class="rop-bar-name"><span class="dot" style="background:${color}"></span>${c}</div>
                    <div class="rop-bar-track">
                      <div class="rop-bar-fill" style="width:${w}%;background:linear-gradient(90deg,#67e8f9,#06b6d4)"></div>
                    </div>
                    <div class="rop-bar-value" style="color:#67e8f9">${fmtEur(rocu)}</div>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="rop-note" style="margin-top:4px">Il fatturato di ognuno diviso i suoi check-up fatti nel periodo.</div>
          </div>
        </div>
      </div>

      <div class="metrics-row" style="margin-top:20px">
        <div class="metric-card metric-green" data-icon="📈">
          <div class="m-label">Fatturato</div>
          <div class="m-value">${fmtEur(agg.fatt)} ${trendChip(agg.trendFatt)}</div>
          <div class="m-sub">${agg.vendite} vendite · ${agg.checkup} check-up</div>
        </div>
        <div class="metric-card metric-cyan" data-icon="💰">
          <div class="m-label">Incassato</div>
          <div class="m-value">${fmtEur(agg.inc)} ${trendChip(agg.trendInc)}</div>
          <div class="m-sub">${fmtEur(agg.daLeadPrecedenti)} da lead dei mesi prima</div>
        </div>
        <div class="metric-card metric-purple" data-icon="🎫">
          <div class="m-label">Vendita media</div>
          <div class="m-value">${fmtEur(agg.ticketMedio)}</div>
          <div class="m-sub">Ticket medio del periodo</div>
        </div>
      </div>
    </section>

    <!-- SEZIONE PERCORSO: funnel -->
    <section>
      <div class="section-label orange">Percorso</div>
      <div class="section-title">Dal contatto alla vendita</div>
      <div class="section-sub">Quanti passano da un passo al successivo</div>
      ${renderPercorso(agg)}
    </section>

    <!-- SEZIONE VENDITORI -->
    <section>
      <div class="section-label purple">Venditori</div>
      <div class="section-title">${coaches.join(' e ')}</div>
      <div class="section-sub">Passa col mouse su un numero per vedere il dettaglio</div>
      <div class="venditori-grid">
        ${coaches.map(c => renderVenditoreCard(c)).join('')}
      </div>
    </section>

    <!-- SEZIONE ANDAMENTO: grafico mensile -->
    <section>
      <div class="section-label">Andamento</div>
      <div class="section-title">Fatturato mese per mese</div>
      ${renderAndamento(coaches)}
    </section>

    <!-- SEZIONE CANALI -->
    <section>
      <div class="section-label cyan">Canali</div>
      <div class="section-title">Da dove arrivano le vendite</div>
      <div class="section-sub">Breakdown per funnel</div>
      <div class="canali-grid">
        ${renderCanali()}
      </div>
    </section>

    <!-- SEZIONE PRODOTTI -->
    <section>
      <div class="section-label pink">Prodotti</div>
      <div class="section-title">Cosa si vende</div>
      <div class="prodotti-card">
        ${renderProdotti()}
      </div>
      <div class="footer-note">
        Fatturato = vendite fatte nel periodo (check-up con VENDUTO spuntato). Incassato = soldi arrivati nel periodo. Le frecce confrontano con il periodo precedente.
      </div>
    </section>
  `;
}

// ─────────────── PERCORSO (funnel visualization) ───────────────
function renderPercorso(agg) {
  const steps = [
    { label: 'Contatti', value: agg.prospect,            color: '#facc15', pctOf: null },
    { label: 'Chiamati', value: agg.chiamatiCount,       color: '#eab308', pctOf: agg.prospect },
    { label: 'Check-up', value: agg.checkup,             color: '#6366f1', pctOf: agg.chiamatiCount },
    { label: 'Vendite',  value: agg.vendite,             color: '#10b981', pctOf: agg.checkup }
  ];
  const max = Math.max(1, agg.prospect);
  const MIN_H = 60, MAX_H = 170;
  const chiusuraPct = agg.checkup ? Math.round((agg.vendite / agg.checkup) * 100) : 0;
  const daChiamare = agg.cuProspect.filter(c => !c.setting).length;

  const nonChiusiTot = state.data.checkup.filter(c => String(c.checkupStato).toUpperCase() === 'FATTO' && !c.venduto && inRange(c.dataCheckup, agg.from, agg.to)).length;
  const motivi = [
    { label: 'In sospeso',       count: 0, color: '#f472b6' },
    { label: 'Non rispondono',   count: 0, color: '#fb923c' },
    { label: 'Prezzo',           count: 0, color: '#f87171' },
    { label: 'Non è il momento', count: 0, color: '#c084fc' }
  ];
  return `
    <div class="prodotti-card">
      <div style="display:grid;grid-template-columns:1fr 300px;gap:32px;align-items:flex-start">
        <div>
          <div style="display:flex;align-items:flex-end;gap:0;padding:12px 0">
            ${steps.map((s, i) => {
              const h = MIN_H + ((s.value / max) * (MAX_H - MIN_H));
              const pct = s.pctOf ? Math.round((s.value / s.pctOf) * 100) : null;
              return `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center">
                  <div style="height:${MAX_H}px;display:flex;align-items:flex-end;width:100%;justify-content:center;position:relative">
                    <div style="width:78%;height:${h}px;background:linear-gradient(180deg,${s.color},${s.color}dd);border-radius:44px;box-shadow:0 8px 24px ${s.color}55, inset 0 -8px 20px ${s.color}88"></div>
                  </div>
                  <div style="font-size:32px;font-weight:800;color:${s.color};line-height:1;margin-top:14px">${s.value}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${s.label}</div>
                </div>
                ${i < steps.length - 1 ? `
                  <div style="display:flex;flex-direction:column;align-items:center;padding:0 4px;margin-bottom:70px">
                    <div style="background:#f1f5f9;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:600;color:var(--text-muted)">${steps[i+1].pctOf ? Math.round((steps[i+1].value / steps[i+1].pctOf)*100) : 0}%</div>
                    <div style="color:#cbd5e1;font-size:16px;margin-top:4px">→</div>
                  </div>
                ` : ''}
              `;
            }).join('')}
          </div>

          <!-- Non chiusi barra -->
          <div style="margin-top:20px">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Non chiusi</div>
            <div style="display:flex;height:10px;border-radius:999px;overflow:hidden;background:#eef2f7;box-shadow:inset 0 1px 3px rgba(0,0,0,0.05)">
              ${motivi.map(m => `<div style="flex:${Math.max(m.count, 1)};background:${m.color};box-shadow:0 0 12px ${m.color}88"></div>`).join('')}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--text-muted);margin-top:10px">
              ${motivi.map(m => `<span><span style="display:inline-block;width:6px;height:6px;background:${m.color};border-radius:50%;margin-right:5px;vertical-align:middle"></span>${m.label} <b style="color:var(--text)">${m.count}</b></span>`).join('')}
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="background:#fafbfd;border:1px solid var(--border);border-radius:14px;padding:16px 18px">
            <div style="font-size:11px;font-weight:700;color:#7c3aed;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px"><span style="display:inline-block;width:6px;height:6px;background:#7c3aed;border-radius:50%;margin-right:6px;vertical-align:middle"></span>Chiusura</div>
            <div style="font-size:34px;font-weight:800;color:#7c3aed;line-height:1">${chiusuraPct}%</div>
          </div>
          <div style="background:#fafbfd;border:1px solid var(--border);border-radius:14px;padding:16px 18px">
            <div style="font-size:11px;font-weight:700;color:#eab308;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px"><span style="display:inline-block;width:6px;height:6px;background:#eab308;border-radius:50%;margin-right:6px;vertical-align:middle"></span>Da chiamare</div>
            <div style="font-size:34px;font-weight:800;color:#eab308;line-height:1">${daChiamare}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────── ANDAMENTO (grafico mensile) ───────────────
function renderAndamento(coaches) {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('it-IT', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2)
    });
  }
  const colors = ['#3b82f6', '#f97316', '#a855f7', '#10b981'];
  // Sorgente: check-up con venduto=true e importo>0 (riga per riga, dalla col IMPORTO del foglio check-up)
  const series = coaches.map((c, i) => {
    const vs = venditeDaCheckup(c);
    const byMonth = {};
    for (let k = 0, L = vs.length; k < L; k++) {
      const v = vs[k];
      if (!v.dataVendita || !v.importo) continue;
      const mk = v.dataVendita.substring(0, 7);
      byMonth[mk] = (byMonth[mk] || 0) + v.importo;
    }
    return {
      coach: c,
      color: colors[i % colors.length],
      values: months.map(m => byMonth[m.key] || 0)
    };
  });
  const maxV = Math.max(0, ...series.flatMap(s => s.values));
  if (maxV === 0) {
    return `<div class="prodotti-card" style="padding:48px;text-align:center;color:var(--text-muted)">
      <div style="font-size:14px;margin-bottom:8px">Nessuna vendita registrata negli ultimi 12 mesi</div>
      <div style="font-size:12px;opacity:0.7">Il grafico si popola quando ci sono check-up con VENDUTO=sì e un IMPORTO</div>
    </div>`;
  }
  const W = 900, H = 260, PAD_L = 60, PAD_R = 20, PAD_T = 20, PAD_B = 44;
  const CW = W - PAD_L - PAD_R;
  const CH = H - PAD_T - PAD_B;
  const stepX = CW / (months.length - 1);
  // Smooth bezier (cardinal spline con tensione)
  function pointsFor(vals) {
    return vals.map((v, i) => ({ x: PAD_L + i * stepX, y: PAD_T + CH - (v / maxV) * CH }));
  }
  function pathFor(vals) {
    const pts = pointsFor(vals);
    if (pts.length < 2) return '';
    const tension = 0.35;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }
  function areaFor(vals) {
    const line = pathFor(vals);
    const x0 = PAD_L;
    const xN = PAD_L + (vals.length - 1) * stepX;
    const yBase = PAD_T + CH;
    return `${line} L${xN},${yBase} L${x0},${yBase} Z`;
  }
  return `
    <div class="prodotti-card">
      <div style="display:flex;justify-content:flex-end;gap:16px;margin-bottom:16px">
        ${series.map(s => `<span style="font-size:12px;color:var(--text-muted);display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;width:14px;height:3px;background:${s.color};border-radius:2px"></span>${s.coach}</span>`).join('')}
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
        <defs>
          ${series.map((s, i) => `
            <linearGradient id="grad-${i}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${s.color}" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/>
            </linearGradient>
          `).join('')}
        </defs>
        ${[0,0.25,0.5,0.75,1].map(f => {
          const y = PAD_T + CH * (1 - f);
          const val = Math.round(maxV * f);
          return `<line x1="${PAD_L}" y1="${y}" x2="${W-PAD_R}" y2="${y}" stroke="#eef2f7" stroke-width="1"/>
                  <text x="${PAD_L - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#94a3b8">€${new Intl.NumberFormat('it-IT').format(val)}</text>`;
        }).join('')}
        ${months.map((m, i) => {
          const x = PAD_L + i * stepX;
          return `<text x="${x}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#94a3b8">${m.label}</text>`;
        }).join('')}
        ${series.map((s, i) => `
          <path d="${areaFor(s.values)}" fill="url(#grad-${i})"/>
          <path d="${pathFor(s.values)}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${s.values.map((v, k) => {
            const pt = pointsFor(s.values)[k];
            return `<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="${s.color}" stroke="white" stroke-width="2"/>`;
          }).join('')}
        `).join('')}
        ${months.map((m, i) => {
          const x = PAD_L + i * stepX;
          const colW = stepX;
          const monthLabel = m.label.charAt(0).toUpperCase() + m.label.slice(1);
          const tipLines = series.map(s => `${s.coach}: €${new Intl.NumberFormat('it-IT').format(s.values[i])}`).join('\n');
          return `<rect x="${x - colW/2}" y="${PAD_T}" width="${colW}" height="${CH}" fill="transparent" style="cursor:crosshair"><title>${monthLabel}\n${tipLines}</title></rect>`;
        }).join('')}
      </svg>
    </div>
  `;
}

// ─────────────── VELOCITÀ MEDIA ───────────────
function velocitaMedia(coach) {
  const cu = state.data.checkup.filter(c => !coach || c.coach === coach);
  const tra = (a, b) => {
    if (!a || !b) return null;
    const da = new Date(a), db = new Date(b);
    return (db - da) / 86400000; // giorni
  };
  const gaps = { contattoChiamata: [], chiamataCheckup: [], checkupVendita: [], contattoVendita: [] };
  cu.forEach(c => {
    if (c.setting && c.dataProspect) {
      // Non abbiamo data chiamata separata — usiamo dataProspect
    }
    if (c.dataProspect && c.dataCheckup) {
      const g = tra(c.dataProspect, c.dataCheckup);
      if (g !== null && g >= 0) gaps.chiamataCheckup.push(g);
    }
    if (c.venduto && c.dataCheckup) {
      // Consideriamo vendita = data checkup (fallback)
      gaps.checkupVendita.push(0);
    }
    if (c.venduto && c.dataProspect && c.dataCheckup) {
      const g = tra(c.dataProspect, c.dataCheckup);
      if (g !== null && g >= 0) gaps.contattoVendita.push(g);
    }
  });
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const fmtGiorni = g => {
    if (!g || g < 0.04) return '—';
    if (g < 1) return Math.round(g * 24) + 'h';
    const d = Math.floor(g);
    const h = Math.round((g - d) * 24);
    return h ? `${d}g ${h}h` : `${d}g`;
  };
  return {
    contattoChiamata: '—',
    chiamataCheckup: fmtGiorni(avg(gaps.chiamataCheckup)),
    checkupVendita: fmtGiorni(avg(gaps.checkupVendita)),
    contattoVendita: fmtGiorni(avg(gaps.contattoVendita))
  };
}

function renderVenditoreCard(coach) {
  const agg = aggregateFor(coach);
  const nMesi = monthsInRange(agg.from, agg.to);
  const obiettivo = (agg.obiettivo || OBIETTIVO_COACH) * nMesi;
  const pctObj = obiettivo ? (agg.fatt / obiettivo) * 100 : 0;
  const mancano = Math.max(0, obiettivo - agg.fatt);
  const stimaVendite = agg.ticketMedio ? Math.ceil(mancano / agg.ticketMedio) : 0;
  const chiusura = agg.checkup ? (agg.vendite / agg.checkup) * 100 : 0;
  const daChiamare = Math.max(0, agg.prospect - agg.chiamatiCount);

  return `
    <div class="venditore-card">
      <div class="venditore-head">
        <div class="venditore-head-left">
          <div class="venditore-avatar">${coach[0].toUpperCase()}</div>
          <div>
            <div class="venditore-name">${coach}</div>
            <div class="venditore-meta">${agg.vendite} vendite · ${agg.checkup} check-up ${trendChip(agg.trendFatt)}</div>
          </div>
        </div>
        ${daChiamare > 0 ? `<div class="venditore-chip">📞 ${daChiamare} da chiamare</div>` : ''}
      </div>

      <div class="venditore-donut-row">
        <div class="venditore-donut">
          ${donutSVG(pctObj, 140)}
          <div class="venditore-donut-center">
            <div class="l">Fatturato</div>
            <div class="v">${fmtEur(agg.fatt)}</div>
            <div class="s">${fmtPctInt(pctObj)} di ${fmtEur(obiettivo)}</div>
          </div>
        </div>
        <div class="venditore-quad">
          <div class="mini-metric cyan">
            <div class="l"><span class="dot" style="background:#06b6d4"></span>Incassato</div>
            <div class="v">${fmtEur(agg.inc)}</div>
          </div>
          <div class="mini-metric purple">
            <div class="l"><span class="dot" style="background:#a855f7"></span>Ticket medio</div>
            <div class="v">${fmtEur(agg.ticketMedio)}</div>
          </div>
          <div class="mini-metric" style="border-left:3px solid #7c3aed">
            <div class="l"><span class="dot" style="background:#7c3aed"></span>Chiusura ${chiusura >= 50 ? '▲' : '▼'}</div>
            <div class="v" style="color:#7c3aed">${fmtPctInt(chiusura)}</div>
          </div>
          <div class="mini-metric" style="border-left:3px solid #06b6d4">
            <div class="l"><span class="dot" style="background:#06b6d4"></span>Lead mesi prima</div>
            <div class="v" style="color:#06b6d4">${fmtEur(agg.daLeadPrecedenti)}</div>
          </div>
        </div>
      </div>

      <div class="venditore-mancano">
        Per l'obiettivo mancano <b>${fmtEur(mancano)}</b>, circa <b>${stimaVendite} vendite</b>
      </div>

      ${(() => {
        const proj = proiezioneFineMese(agg.fatt, agg.from, agg.to);
        if (!proj) return '';
        const pctProj = obiettivo ? (proj / obiettivo) * 100 : 0;
        const good = pctProj >= 100;
        return `
          <div class="se-continua-box ${good ? 'ok' : 'warn'}">
            <div class="se-continua-label">Se continua così</div>
            <div class="se-continua-value">${fmtEur(proj)}</div>
            <div class="se-continua-sub">a fine mese · <b>${fmtPctInt(pctProj)}</b> dell'obiettivo</div>
          </div>
        `;
      })()}

      <!-- ROP dark card mini -->
      <div style="background:radial-gradient(ellipse at top right,#1e293b 0%,#0f172a 60%);border-radius:14px;padding:18px 22px;color:white;box-shadow:0 8px 20px rgba(15,23,42,0.15);position:relative;overflow:hidden;">
        <div style="font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,0.55);text-transform:uppercase;font-weight:600;margin-bottom:4px">ROP · Resa per contatto</div>
        <div style="display:flex;align-items:center;gap:14px">
          <div style="font-size:32px;font-weight:800;color:#facc15">${fmtEur(agg.rop)}</div>
          ${trendChip(agg.rop && agg.ropTarget ? ((agg.rop - agg.ropTarget) / agg.ropTarget) * 100 : 0)}
          <div style="flex:1;position:relative">
            <div style="height:7px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:visible;position:relative">
              <div style="height:100%;width:${Math.min(100,(agg.rop/600)*100)}%;background:linear-gradient(90deg,#fde047 0%,#facc15 50%,#eab308 100%);border-radius:999px;box-shadow:0 0 12px rgba(250,204,21,0.6),0 0 4px rgba(250,204,21,0.9)"></div>
              <div style="position:absolute;top:-3px;bottom:-3px;left:${(agg.ropTarget/600)*100}%;width:2px;background:white;z-index:2"></div>
            </div>
          </div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);white-space:nowrap">ROC ${fmtEur(agg.roc)}</div>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:6px">per contatto · ${agg.prospect} contatti · obiettivo ${fmtEur(agg.ropTarget)}</div>
        <!-- ROCU · Resa per check-up -->
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)">
          <div style="font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,0.55);text-transform:uppercase;font-weight:600;margin-bottom:4px">ROCU · Resa per check-up</div>
          <div style="display:flex;align-items:center;gap:14px">
            <div style="font-size:24px;font-weight:800;color:#06b6d4">${fmtEur(agg.checkup ? Math.round(agg.fatt / agg.checkup) : 0)}</div>
            <div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden">
              <div style="height:100%;width:${Math.min(100,(agg.checkup ? (agg.fatt/agg.checkup)/1500 : 0)*100)}%;background:linear-gradient(90deg,#67e8f9 0%,#06b6d4 100%);border-radius:999px"></div>
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);white-space:nowrap">per check-up · ${agg.checkup}</div>
          </div>
        </div>
      </div>

      ${renderNonChiusiCard(coach)}
      ${renderAccontiCard(coach)}
      ${renderVelocitaCard(coach)}
      ${renderChiParlaCard(coach)}
      ${renderVotoCard(coach)}

      <button class="btn-analizza" onclick="state.coachSubView='stats';state.activeTab='coach:${coach}';render();window.scrollTo({top:0,behavior:'smooth'})">Analizza ${coach}</button>
    </div>
  `;
}

// Non chiusi = check-up con VENDUTO=false MA il check-up è stato FATTO
// Motivi (In sospeso / Non rispondono / Prezzo / Non è il momento) — placeholder finché non colleghiamo colonne foglio
function renderNonChiusiCard(coach) {
  const cu = state.data.checkup.filter(c => (!coach || c.coach === coach) && String(c.checkupStato).toUpperCase() === 'FATTO' && !c.venduto);
  const total = cu.length;
  const motivi = [
    { label: 'In sospeso',       count: 0, color: '#f472b6' },
    { label: 'Non rispondono',   count: 0, color: '#fb923c' },
    { label: 'Prezzo',           count: 0, color: '#f87171' },
    { label: 'Non è il momento', count: 0, color: '#c084fc' }
  ];
  // Segmenti per la barra (proporzione ai count; se tutti 0 barra grigia uniforme)
  const sum = motivi.reduce((a, m) => a + m.count, 0);
  const barSegs = sum > 0
    ? motivi.map(m => `<div style="flex:${m.count};background:${m.color};box-shadow:0 0 8px ${m.color}55"></div>`).join('')
    : motivi.map(m => `<div style="flex:1;background:${m.color}55"></div>`).join('');
  return `
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">
        Non chiusi · ${total}
      </div>
      <div style="display:flex;height:10px;border-radius:999px;overflow:hidden;margin-bottom:10px;background:#eef2f7">
        ${barSegs}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--text-muted)">
        ${motivi.map(m => `<span><span style="display:inline-block;width:6px;height:6px;background:${m.color};border-radius:50%;margin-right:5px;vertical-align:middle"></span>${m.label} <b style="color:var(--text)">${m.count}</b></span>`).join('')}
      </div>
    </div>
  `;
}

function renderAccontiCard(coach) {
  // Placeholder: 0 acconti finche non aggiungi colonna "Acconto" nel foglio
  const acconti = 0;
  const importo = 0;
  return `
    <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px">
      <span>⏳</span>
      <span><b style="color:var(--text)">${acconti} acconti</b> da chiudere · <b style="color:var(--text)">${fmtEur(importo)}</b></span>
    </div>
  `;
}

function renderChiParlaCard(coach) {
  // Placeholder: 50/50. Da collegare Fathom API in futuro
  const coachPct = 50;
  const clientePct = 50;
  const chiamate = 0;
  return `
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">
        Chi parla nelle chiamate · media di ${chiamate} chiamate registrate
      </div>
      <div style="display:flex;height:8px;border-radius:999px;overflow:hidden;background:#eef2f7;margin-bottom:6px">
        <div style="width:${coachPct}%;background:#ef4444"></div>
        <div style="width:${clientePct}%;background:#06b6d4"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted)">
        <span>Parla ${coach} · <b style="color:var(--text)">${coachPct}%</b></span>
        <span>Parla il cliente · <b style="color:var(--text)">${clientePct}%</b></span>
      </div>
      <div style="font-size:10px;color:var(--text-dim);margin-top:6px;font-style:italic">In arrivo: analisi tramite Fathom API</div>
    </div>
  `;
}

function renderVotoCard(coach) {
  // Placeholder voto
  const voto = 0;
  const chiamate = 0;
  return `
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Voto delle chiamate</div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;border-radius:50%;background:#fef3c7;color:#d97706;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;border:2px solid #fde68a">${voto.toFixed(1).replace('.', ',')}</div>
        <div style="font-size:12px;color:var(--text-muted)">su 10 · media di ${chiamate} chiamate registrate nel periodo</div>
      </div>
    </div>
  `;
}

function renderVelocitaCard(coach) {
  const v = velocitaMedia(coach);
  return `
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Velocità · in media</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        <div class="mini-metric">
          <div class="l">Contatto → chiamata</div>
          <div class="v" style="font-size:16px">${v.contattoChiamata}</div>
        </div>
        <div class="mini-metric">
          <div class="l">Chiamata → check-up</div>
          <div class="v" style="font-size:16px">${v.chiamataCheckup}</div>
        </div>
        <div class="mini-metric">
          <div class="l">Check-up → vendita</div>
          <div class="v" style="font-size:16px">${v.checkupVendita}</div>
        </div>
        <div class="mini-metric">
          <div class="l">Contatto → vendita</div>
          <div class="v" style="font-size:16px">${v.contattoVendita}</div>
        </div>
      </div>
    </div>
  `;
}

function renderCanali() {
  const funnels = state.data.config.funnels;
  // Dati dal foglio Sales TV per canale (fonte aggregata) + fallback ai check-up grezzi
  const canali = (state.data.salesTV && state.data.salesTV.canali) || {};
  const sp = sheetPeriod();
  const [from, to] = sp ? [sp.from, sp.to] : computePeriodRange();
  const checkupAll = (state.data && state.data.checkup) || [];
  const venditeAll = venditeDaCheckup(null).filter(v => inRange(v.dataVendita, from, to));

  const kpis = funnels.map(fn => {
    const row = canali[fn] && canali[fn].totale;
    // Fonte aggregata (foglio Sales TV per canale)
    const aggContatti = row ? (row.prospectAssegnati || 0) : 0;
    const aggCheckup = row ? (row.checkup || 0) : 0;
    const aggVendite = row ? (row.vendite || 0) : 0;
    const aggFatt    = row ? (row.fattPerCassa || 0) : 0;
    const aggRop     = row ? (row.rop || 0) : 0;
    // Fonte grezza dai check-up prenotati, filtrata per funnel + periodo
    const cuFunnel = checkupAll.filter(c => c.funnel === fn);
    const rawProspect = cuFunnel.filter(c => inRange(c.dataProspect, from, to)).length;
    const rawCheckup = cuFunnel.filter(c => inRange(c.dataCheckup, from, to) && String(c.checkupStato).toUpperCase() === 'FATTO').length;
    const rawCheckupPrenotati = cuFunnel.filter(c => c.dataCheckup && inRange(c.dataCheckup, from, to)).length;
    const vFunnel = venditeAll.filter(v => v.funnel === fn);
    const rawVendite = vFunnel.length;
    const rawFatt = vFunnel.reduce((s, v) => s + v.importo, 0);
    // Prende il valore più ricco tra aggregato e grezzo
    return {
      fn,
      contatti: Math.max(aggContatti, rawProspect),
      checkup: Math.max(aggCheckup, rawCheckupPrenotati),
      vendite: Math.max(aggVendite, rawVendite),
      fatt: Math.max(aggFatt, rawFatt),
      rop: aggRop || (rawProspect ? Math.round(rawFatt / rawProspect) : 0)
    };
  });
  const maxContatti = Math.max(1, ...kpis.map(k => k.contatti));
  return kpis.map(k => {
    const barW = (k.contatti / maxContatti) * 100;
    const meta = CHANNEL_META[k.fn] || { icon: '📦' };
    return `
      <div class="canale-card">
        <div class="canale-head">
          <div class="canale-left">
            <div class="canale-icon">${meta.icon}</div>
            <div>
              <div class="canale-name">${k.fn}</div>
              <div class="canale-meta">${k.contatti} contatti · ${k.checkup} check-up</div>
            </div>
          </div>
          <div class="canale-right">
            <div class="canale-fatt">${fmtEur(k.fatt)}</div>
            <div class="canale-sub">${k.vendite} vendite · ROP <b>${fmtEur(k.rop)}</b></div>
          </div>
        </div>
        <div class="canale-bar"><div class="canale-bar-fill" style="width:${barW}%"></div></div>
      </div>
    `;
  }).join('');
}

function renderProdotti() {
  // Sorgente: check-up prenotati con venduto=true (col IMPORTO + PRODOTTO VENDUTO)
  const sp = sheetPeriod();
  const [from, to] = sp ? [sp.from, sp.to] : computePeriodRange();
  const all = venditeDaCheckup(null);
  const vs = all.filter(v => v.dataVendita && v.prodotto && inRange(v.dataVendita, from, to) && v.importo > 0);
  const byProd = {};
  vs.forEach(v => {
    const p = v.prodotto || '—';
    if (!byProd[p]) byProd[p] = { fatt: 0, count: 0 };
    byProd[p].fatt += v.importo;
    byProd[p].count++;
  });
  const rows = Object.entries(byProd).sort((a, b) => b[1].fatt - a[1].fatt);
  if (rows.length === 0) return `<div style="text-align:center;padding:32px;color:var(--text-muted)">Nessuna vendita nel periodo</div>`;
  const max = rows[0][1].fatt;
  return `<div class="prodotti-list">${
    rows.map(([name, v]) => `
      <div class="prodotto-row">
        <div class="prodotto-name">${esc(name)}</div>
        <div class="prodotto-bar">
          <div class="prodotto-bar-paid" style="width:${(v.fatt / max) * 100}%"></div>
        </div>
        <div class="prodotto-value"><b>${fmtEur(v.fatt)}</b> · ${v.count}</div>
      </div>
    `).join('')
  }</div>`;
}

function renderCoachDetail(coach) {
  const agg = aggregateFor(coach);
  const sub = state.coachSubView || 'stats';
  const counts = subViewCounts(coach, agg);

  const subNav = `
    <div class="coach-subnav">
      ${COACH_SUBVIEWS.map(v => {
        const n = counts[v.id];
        return `<button class="coach-sub ${sub === v.id ? 'active' : ''}" data-sub="${v.id}">
          <span class="coach-sub-ico">${v.num}</span>
          <span class="coach-sub-lbl">${v.label}</span>
          ${(n != null && n > 0) ? `<span class="coach-sub-badge">${n}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`;

  let body = '';
  switch (sub) {
    case 'calendario':    body = renderSubCalendario(coach, agg); break;
    case 'contatti':      body = renderSubList(coach, agg, 'contatti'); break;
    case 'da-chiamare':   body = renderSubList(coach, agg, 'da-chiamare'); break;
    case 'no-risp':       body = renderSubList(coach, agg, 'no-risp'); break;
    case 'sospesi':       body = renderSubList(coach, agg, 'sospesi'); break;
    case 'checkup':       body = renderSubList(coach, agg, 'checkup'); break;
    case 'follow-up':     body = renderSubList(coach, agg, 'follow-up'); break;
    case 'da-risentire':  body = renderSubList(coach, agg, 'da-risentire'); break;
    case 'vendite':       body = renderSubVendite(coach, agg); break;
    case 'da-pagare':     body = renderSubDaPagare(coach, agg); break;
    case 'persi':         body = renderSubList(coach, agg, 'persi'); break;
    case 'registrazioni': body = renderSubRegistrazioni(coach, agg); break;
    default:              body = renderSubStats(coach, agg); break;
  }

  return subNav + body;
}

// ─────────────── COACH SUB-VIEWS ───────────────

function filterByCoachAndPeriod(coach, agg) {
  const d = state.data.checkup.filter(c =>
    (!coach || c.coach === coach)
  );
  return d;
}

function statusEq(stato, ...targets) {
  const s = String(stato || '').toUpperCase().replace(/\s+/g, ' ').trim();
  return targets.some(t => s.includes(t.toUpperCase()));
}

// Classifica stato check-up in bucket per sub-nav
function classifyCheckup(c, agg) {
  const inPeriodProspect = inRange(c.dataProspect, agg.from, agg.to);
  const inPeriodCheckup = inRange(c.dataCheckup, agg.from, agg.to);
  const stato = String(c.checkupStato || '').toUpperCase();

  const buckets = [];
  if (inPeriodProspect) buckets.push('contatti');
  if (inPeriodProspect && !c.dataCheckup) buckets.push('da-chiamare');
  if (c.dataCheckup && inPeriodCheckup) {
    buckets.push('checkup');
    if (stato.includes('FATTO')) {
      if (c.venduto) {
        // vendita → nessun bucket qui (è in Vendite)
      }
    }
    if (statusEq(stato, 'NO SHOW', 'NO RISP', 'NON RISPONDE', 'NR')) buckets.push('no-risp');
    if (statusEq(stato, 'SOSPES', 'GIARDINO')) buckets.push('sospesi');
    if (statusEq(stato, 'FOLLOW', 'DA RICHIAMARE', 'RICONTATTARE')) buckets.push('follow-up');
    if (statusEq(stato, 'RISENTIRE')) buckets.push('da-risentire');
    if (statusEq(stato, 'PERSO', 'NON VENDUTO', 'KO')) buckets.push('persi');
  }
  return buckets;
}

function subViewCounts(coach, agg) {
  const data = filterByCoachAndPeriod(coach, agg);
  const counts = { stats: null, calendario: null, registrazioni: null };
  const keys = ['contatti','da-chiamare','no-risp','sospesi','checkup','follow-up','da-risentire','persi'];
  keys.forEach(k => counts[k] = 0);
  data.forEach(c => {
    classifyCheckup(c, agg).forEach(b => {
      if (counts[b] != null) counts[b]++;
    });
  });
  const vendite = venditeDaCheckup(coach).filter(v => inRange(v.dataVendita, agg.from, agg.to));
  counts.vendite = vendite.length;
  // Da pagare = righe Vendite Regina con acconto spuntato ma saldo non ancora pagato
  const vendRG = ((state.data && state.data.vendite) || [])
    .filter(v => v.dataVendita && v.importo > 0)
    .filter(v => !coach || v.coach === coach)
    .filter(v => inRange(v.dataVendita, agg.from, agg.to));
  counts['da-pagare'] = vendRG.filter(v => v.acconto && !v.saldo).length;
  return counts;
}

function renderSubStats(coach, agg) {
  const nMesi = monthsInRange(agg.from, agg.to);
  const obiettivo = (agg.obiettivo || OBIETTIVO_COACH) * nMesi;
  const pctObj = obiettivo ? (agg.fatt / obiettivo) * 100 : 0;
  const mancano = Math.max(0, obiettivo - agg.fatt);
  const stimaVendite = agg.ticketMedio ? Math.ceil(mancano / agg.ticketMedio) : 0;
  const chiusura = agg.checkup ? (agg.vendite / agg.checkup) * 100 : 0;
  const dayEnd = agg.to.split('-')[2];
  const monthName = new Date(agg.to).toLocaleDateString('it-IT', { month: 'long' });

  const vendite = venditeDaCheckup(coach)
    .filter(v => inRange(v.dataVendita, agg.from, agg.to))
    .sort((a, b) => (b.dataVendita || '').localeCompare(a.dataVendita || ''));

  const daChiamare = Math.max(0, agg.prospect - agg.chiamatiCount);
  const proj = proiezioneFineMese(agg.fatt, agg.from, agg.to);
  const pctProj = obiettivo ? (proj / obiettivo) * 100 : 0;
  const projGood = pctProj >= 100;

  return `
    <section>
      <div class="section-label">Obiettivo</div>
      <div class="section-title-row">
        <div class="section-title">${coach} nel periodo</div>
        ${daChiamare > 0 ? `<div class="venditore-chip">📞 ${daChiamare} da chiamare</div>` : ''}
      </div>
      <div class="section-sub">${agg.vendite} vendite · ${agg.checkup} check-up · ${trendChip(agg.trendFatt)}</div>

      <div class="team-grid">
        <div class="team-card">
          <div class="donut donut-lg">
            ${donutSVG(pctObj)}
            <div class="donut-center">
              <div class="donut-label">Fatturato</div>
              <div class="donut-value donut-value-eur">${fmtEur(agg.fatt)}</div>
              <div class="donut-sub">${fmtPctInt(pctObj)} di ${fmtEur(obiettivo)}</div>
            </div>
          </div>
          <div class="team-info">
            <div class="info-sub-top">Per l'obiettivo mancano <b>${fmtEur(mancano)}</b>, circa <b>${stimaVendite} vendite</b></div>
            ${proj > 0 ? `
              <div class="se-continua-box ${projGood ? 'ok' : 'warn'}" style="margin-top:12px">
                <div class="se-continua-label">Se continua così</div>
                <div class="se-continua-value">${fmtEur(proj)}</div>
                <div class="se-continua-sub">a fine mese · <b>${fmtPctInt(pctProj)}</b> dell'obiettivo</div>
              </div>
              <div class="info-hint" style="margin-top:10px">dove si arriva oggi a ritmo costante</div>
            ` : `<div class="info-hint">entro il ${dayEnd} ${monthName}</div>`}
          </div>
        </div>

        <div class="rop-card">
          <div class="rop-header">ROP · Resa per contatto</div>
          <div class="rop-main">
            <div class="rop-value">${fmtEur(agg.rop)}</div>
            ${trendChip(agg.rop ? ((agg.rop - agg.ropTarget) / agg.ropTarget) * 100 : 0)}
          </div>
          <div class="rop-sub">${fmtEur(agg.fatt)} di fatturato su ${agg.prospect} contatti · obiettivo <b>${fmtEur(agg.ropTarget)}</b></div>
          <div class="rop-note">La linea è l'obiettivo di ${fmtEur(agg.ropTarget)} per contatto. Chiusura: <b style="color:#eab308">${fmtPctInt(chiusura)}</b> · Vendita media: <b>${fmtEur(agg.ticketMedio)}</b>.</div>
          <div class="roc-badges">
            <div class="roc-badge">
              <div class="roc-label">ROC</div>
              <div class="roc-value">${fmtEur(agg.roc)}</div>
              <div class="roc-sub">per chiamato</div>
            </div>
            <div class="roc-badge roc-badge-rocu">
              <div class="roc-label">ROCU</div>
              <div class="roc-value">${fmtEur(agg.rocu)}</div>
              <div class="roc-sub">per check-up · ${agg.checkup}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="metrics-row" style="margin-top:20px">
        <div class="metric-card metric-green" data-icon="📈">
          <div class="m-label">Fatturato</div>
          <div class="m-value">${fmtEur(agg.fatt)} ${trendChip(agg.trendFatt)}</div>
          <div class="m-sub">${agg.vendite} vendite · ${agg.checkup} check-up</div>
        </div>
        <div class="metric-card metric-cyan" data-icon="💰">
          <div class="m-label">Incassato</div>
          <div class="m-value">${fmtEur(agg.inc)} ${trendChip(agg.trendInc)}</div>
          <div class="m-sub">${fmtEur(agg.daLeadPrecedenti)} da lead precedenti</div>
        </div>
        <div class="metric-card metric-orange" data-icon="📞">
          <div class="m-label">Chiamati</div>
          <div class="m-value">${fmtNum(agg.chiamatiCount)}</div>
          <div class="m-sub">${agg.prospect} prospect · ${agg.checkup} check-up fatti</div>
        </div>
      </div>

      <!-- Mini metric row: Chiusura · Ticket medio · Lead mesi prima -->
      <div class="mini-metric-row">
        <div class="mini-metric purple">
          <div class="l"><span class="dot" style="background:#7c3aed"></span>Chiusura</div>
          <div class="v" style="color:#7c3aed">${fmtPctInt(chiusura)}</div>
          <div class="s">${agg.vendite}/${agg.checkup} check-up</div>
        </div>
        <div class="mini-metric purple">
          <div class="l"><span class="dot" style="background:#a855f7"></span>Ticket medio</div>
          <div class="v" style="color:#a855f7">${fmtEur(agg.ticketMedio)}</div>
          <div class="s">media per vendita</div>
        </div>
        <div class="mini-metric cyan">
          <div class="l"><span class="dot" style="background:#06b6d4"></span>Lead mesi prima</div>
          <div class="v" style="color:#06b6d4">${fmtEur(agg.daLeadPrecedenti)}</div>
          <div class="s">incassato da lead passati</div>
        </div>
      </div>
    </section>

    <!-- PERCORSO -->
    <section>
      <div class="section-label orange">Percorso</div>
      <div class="section-title">Dal contatto alla vendita</div>
      <div class="section-sub">Quanti passano da un passo al successivo</div>
      ${renderPercorso(agg)}
    </section>

    <!-- NON CHIUSI / ACCONTI / VELOCITÀ / CHI PARLA / VOTO -->
    <section>
      <div class="section-label">Dettaglio</div>
      <div class="section-title">Qualità del lavoro di ${coach}</div>
      ${renderNonChiusiCard(coach)}
      ${renderAccontiCard(coach)}
      ${renderVelocitaCard(coach)}
      ${renderChiParlaCard(coach)}
      ${renderVotoCard(coach)}
    </section>

    <section>
      <div class="section-label purple">Vendite recenti</div>
      <div class="section-title">Ultimi ${Math.min(vendite.length, 10)} chiusi</div>
      <div class="prodotti-card">
        ${vendite.length === 0 ? `<div style="text-align:center;padding:32px;color:var(--text-muted)">Nessuna vendita nel periodo</div>` :
        `<table style="width:100%;border-collapse:collapse">
          <thead><tr style="text-align:left;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">
            <th style="padding:8px 12px">Data</th><th style="padding:8px 12px">Cliente</th><th style="padding:8px 12px">Prodotto</th><th style="padding:8px 12px">Funnel</th><th style="padding:8px 12px;text-align:right">Importo</th>
          </tr></thead>
          <tbody>${
            vendite.slice(0, 10).map(v => `<tr style="border-top:1px solid var(--border);font-size:13px">
              <td style="padding:12px">${fmtDate(v.dataVendita)}</td>
              <td style="padding:12px">${v.nome} ${v.cognome}</td>
              <td style="padding:12px">${v.prodotto}</td>
              <td style="padding:12px">${v.funnel}</td>
              <td style="padding:12px;text-align:right;font-weight:600;color:var(--accent-green)">${fmtEur(v.importo)}</td>
            </tr>`).join('')
          }</tbody></table>`}
      </div>
    </section>
  `;
}

// ─────────────── SUB-VIEW: Lista contatti/check-up ─────────────────

function subListData(coach, agg, kind) {
  const data = filterByCoachAndPeriod(coach, agg);
  return data.filter(c => classifyCheckup(c, agg).includes(kind))
    .sort((a, b) => {
      const dA = kind === 'contatti' || kind === 'da-chiamare' ? (a.dataProspect || '') : (a.dataCheckup || a.dataProspect || '');
      const dB = kind === 'contatti' || kind === 'da-chiamare' ? (b.dataProspect || '') : (b.dataCheckup || b.dataProspect || '');
      return dB.localeCompare(dA);
    });
}

function renderSubList(coach, agg, kind) {
  const titles = {
    'contatti':     { lbl: 'CONTATTI', title: 'Contatti nel periodo', sub: 'Prospect che hanno fatto la richiesta' },
    'da-chiamare':  { lbl: 'DA CHIAMARE', title: 'Prospect da contattare', sub: 'Non hanno ancora un check-up fissato' },
    'no-risp':      { lbl: 'NO RISPOSTA', title: 'No show / non risponde', sub: 'Check-up andati a vuoto' },
    'sospesi':      { lbl: 'SOSPESI', title: 'Check-up sospesi', sub: 'In valutazione o pausa' },
    'checkup':      { lbl: 'CHECK-UP', title: 'Tutti i check-up del periodo', sub: 'Fatti o programmati' },
    'follow-up':    { lbl: 'FOLLOW-UP', title: 'Da ricontattare', sub: 'Richiesto follow-up' },
    'da-risentire': { lbl: 'DA RISENTIRE', title: 'Da risentire', sub: 'Prospect da risentire' },
    'persi':        { lbl: 'PERSI', title: 'Check-up persi', sub: 'Non vendita' }
  };
  const meta = titles[kind] || { lbl: kind.toUpperCase(), title: kind, sub: '' };
  const rows = subListData(coach, agg, kind);

  return `
    <section>
      <div class="section-label">${meta.lbl}</div>
      <div class="section-title">${meta.title}</div>
      <div class="section-sub">${meta.sub} · ${rows.length} ${rows.length === 1 ? 'elemento' : 'elementi'}</div>

      <div class="prodotti-card" style="margin-top:12px">
        ${rows.length === 0 ? emptyBox('Nessun dato nel periodo') : `
        <table class="data-table">
          <thead><tr>
            <th>Data prospect</th><th>Data check-up</th><th>Cliente</th><th>Funnel</th><th>Stato</th><th>Contatto</th>
          </tr></thead>
          <tbody>
            ${rows.map(c => `<tr>
              <td>${fmtDate(c.dataProspect)}</td>
              <td>${fmtDate(c.dataCheckup) || '—'}</td>
              <td><b>${esc(c.nome)} ${esc(c.cognome)}</b></td>
              <td>${esc(c.funnel)}</td>
              <td>${statoChip(c.checkupStato, c.venduto)}</td>
              <td class="muted-sm">${esc(c.telefono) || esc(c.email) || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </section>
  `;
}

// ─────────────── SUB-VIEW: Calendario ─────────────────

function renderSubCalendario(coach, agg) {
  // Mostra il mese che contiene `from`. Le celle fuori dal periodo [from,to] sono "fuori range".
  const [fy, fm, fd] = agg.from.split('-').map(Number);
  const monthStart = new Date(fy, fm - 1, 1);
  const monthEnd = new Date(fy, fm, 0);
  const daysInMonth = monthEnd.getDate();
  const monthName = monthStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  // Pre-calcolo veloce byDay in un unico passaggio
  const byDay = Object.create(null);
  const checkup = state.data.checkup;
  for (let i = 0, L = checkup.length; i < L; i++) {
    const c = checkup[i];
    if ((coach && c.coach !== coach) || !c.dataCheckup) continue;
    if (!c.dataCheckup.startsWith(`${fy}-${String(fm).padStart(2,'0')}`)) continue;
    (byDay[c.dataCheckup] = byDay[c.dataCheckup] || { checkup: [], vendite: [] }).checkup.push(c);
  }
  const vendite = venditeDaCheckup(coach);
  for (let i = 0, L = vendite.length; i < L; i++) {
    const v = vendite[i];
    if (!v.dataVendita) continue;
    if (!v.dataVendita.startsWith(`${fy}-${String(fm).padStart(2,'0')}`)) continue;
    (byDay[v.dataVendita] = byDay[v.dataVendita] || { checkup: [], vendite: [] }).vendite.push(v);
  }

  const dowShort = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const padStart = (monthStart.getDay() + 6) % 7; // Lun=0

  // Costruisci griglia con 42 slot (6 settimane) in un singolo array per velocità
  const cells = [];
  for (let i = 0; i < padStart; i++) cells.push('<div class="cal-cell cal-empty"></div>');
  const mm = String(fm).padStart(2, '0');
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${fy}-${mm}-${String(d).padStart(2, '0')}`;
    const info = byDay[iso];
    const inPeriod = iso >= agg.from && iso <= agg.to;
    const cls = `cal-cell ${info ? 'cal-has' : ''} ${inPeriod ? '' : 'cal-out'}`.trim();
    if (!info) {
      cells.push(`<div class="${cls}"><div class="cal-dnum">${d}</div></div>`);
      continue;
    }
    const nCU = info.checkup.length, nVD = info.vendite.length;
    let totImp = 0; for (let k = 0; k < nVD; k++) totImp += info.vendite[k].importo;
    let items = '';
    const maxCU = Math.min(2, nCU);
    for (let k = 0; k < maxCU; k++) {
      const c = info.checkup[k];
      items += `<div class="cal-item cal-item-cu">${esc(c.nome)} ${(esc(c.cognome)||'').slice(0,1)}.</div>`;
    }
    const maxVD = Math.min(2, nVD);
    for (let k = 0; k < maxVD; k++) {
      const v = info.vendite[k];
      items += `<div class="cal-item cal-item-vd">${esc(v.nome)}</div>`;
    }
    const more = nCU + nVD - maxCU - maxVD;
    cells.push(
      `<div class="${cls}"><div class="cal-dnum">${d}</div>${items}` +
      (more > 0 ? `<div class="cal-more">+${more}</div>` : '') +
      (totImp > 0 ? `<div class="cal-tot">${fmtEur(totImp)}</div>` : '') +
      `</div>`
    );
  }
  while (cells.length % 7 !== 0) cells.push('<div class="cal-cell cal-empty"></div>');

  const dowHtml = dowShort.map(d => `<div class="cal-dow">${d}</div>`).join('');
  const calLabel = `${monthName} · evidenziato ${fmtDate(agg.from)} → ${fmtDate(agg.to)}`;

  return `
    <section>
      <div class="section-label">CALENDARIO</div>
      <div class="section-title">Agenda ${coach}</div>
      <div class="section-sub">Check-up e vendite · ${calLabel}</div>

      <div class="cal-legend">
        <span class="cal-dot cal-dot-cu"></span> Check-up
        <span class="cal-dot cal-dot-vd"></span> Vendita
        <span class="cal-dot cal-dot-out"></span> Fuori periodo
      </div>

      <div class="cal-grid">
        ${dowHtml}
        ${cells.join('')}
      </div>
    </section>
  `;
}

// ─────────────── SUB-VIEW: Vendite ─────────────────

function renderSubVendite(coach, agg) {
  const rows = venditeDaCheckup(coach)
    .filter(v => inRange(v.dataVendita, agg.from, agg.to))
    .sort((a, b) => (b.dataVendita || '').localeCompare(a.dataVendita || ''));
  const totFatt = rows.reduce((s, v) => s + v.importo, 0);
  const totInc = rows.reduce((s, v) => s + ((v.rateIncassate || 0) * (v.nRate ? v.importo / v.nRate : v.importo)), 0);

  return `
    <section>
      <div class="section-label purple">VENDITE</div>
      <div class="section-title">Vendite nel periodo</div>
      <div class="section-sub">${rows.length} vendite · fatturato ${fmtEur(totFatt)}</div>

      <div class="prodotti-card" style="margin-top:12px">
        ${rows.length === 0 ? emptyBox('Nessuna vendita nel periodo') : `
        <table class="data-table">
          <thead><tr>
            <th>Data</th><th>Cliente</th><th>Prodotto</th><th>Funnel</th><th>Modalità</th><th>Rate</th><th style="text-align:right">Importo</th>
          </tr></thead>
          <tbody>
            ${rows.map(v => `<tr>
              <td>${fmtDate(v.dataVendita)}</td>
              <td><b>${esc(v.nome)} ${esc(v.cognome)}</b></td>
              <td>${esc(v.prodotto)}</td>
              <td>${esc(v.funnel)}</td>
              <td>${esc(v.modalita) || '—'}</td>
              <td>${v.rateIncassate || 0}/${v.nRate || '—'}</td>
              <td style="text-align:right;font-weight:600;color:var(--accent-emerald)">${fmtEur(v.importo)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </section>
  `;
}

// ─────────────── SUB-VIEW: Da pagare ─────────────────

function renderSubDaPagare(coach, agg) {
  // Fonte unica: foglio Vendite Regina. "Da pagare" = clienti con Acconto spuntato
  // ma Saldo non ancora arrivato (colonne J e K del foglio).
  const rows = ((state.data && state.data.vendite) || [])
    .filter(v => v.dataVendita && v.importo > 0)
    .filter(v => !coach || v.coach === coach)
    .filter(v => inRange(v.dataVendita, agg.from, agg.to))
    .filter(v => v.acconto && !v.saldo)
    .sort((a, b) => (a.dataVendita || '').localeCompare(b.dataVendita || ''));
  const totResiduo = rows.reduce((s, v) => s + v.importo, 0);

  return `
    <section>
      <div class="section-label">DA PAGARE</div>
      <div class="section-title">Acconto incassato, saldo mancante</div>
      <div class="section-sub">${rows.length} clienti · da incassare ${fmtEur(totResiduo)}</div>

      <div class="prodotti-card" style="margin-top:12px">
        ${rows.length === 0 ? emptyBox('Nessun saldo in sospeso nel periodo') : `
        <table class="data-table">
          <thead><tr>
            <th>Data vendita</th><th>Cliente</th><th>Prodotto</th><th>Modalità</th><th>Stato</th><th style="text-align:right">Da incassare</th>
          </tr></thead>
          <tbody>
            ${rows.map(v => `<tr>
              <td>${fmtDate(v.dataVendita)}</td>
              <td><b>${esc(v.nome)} ${esc(v.cognome)}</b></td>
              <td>${esc(v.prodotto)}</td>
              <td>${esc(v.modalita) || '—'}</td>
              <td><span class="chip chip-yellow">Solo acconto</span></td>
              <td style="text-align:right;font-weight:600;color:#d97706">${fmtEur(v.importo)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </section>
  `;
}

// ─────────────── SUB-VIEW: Registrazioni ─────────────────

function renderSubRegistrazioni(coach, agg) {
  return `
    <section>
      <div class="section-label">REGISTRAZIONI</div>
      <div class="section-title">Registrazioni check-up</div>
      <div class="section-sub">Link alle registrazioni Meet / Zoom</div>
      <div class="prodotti-card" style="margin-top:12px">
        ${emptyBox('Funzione in arrivo — qui apparirà la lista registrazioni collegate ai check-up del venditore')}
      </div>
    </section>
  `;
}

// ─────────────── Helpers UI ─────────────────

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function emptyBox(msg) {
  return `<div style="text-align:center;padding:32px;color:var(--text-muted)">${esc(msg)}</div>`;
}

function statoChip(stato, venduto) {
  const s = String(stato || '').trim();
  if (!s && !venduto) return `<span class="chip chip-grey">—</span>`;
  if (venduto) return `<span class="chip chip-green">Venduto</span>`;
  const up = s.toUpperCase();
  let cls = 'chip-grey';
  if (up.includes('FATTO')) cls = 'chip-blue';
  else if (up.includes('NO SHOW') || up.includes('NO RISP')) cls = 'chip-red';
  else if (up.includes('SOSPES') || up.includes('GIARDINO')) cls = 'chip-yellow';
  else if (up.includes('FOLLOW') || up.includes('RICHIAMARE')) cls = 'chip-purple';
  else if (up.includes('PERSO') || up.includes('NON VENDUTO')) cls = 'chip-red';
  return `<span class="chip ${cls}">${esc(s)}</span>`;
}

// ─────────────── COPY TV ─────────────────

const COPY_BLOCKS = [
  { id: 'obiezioni',    icon: '🛑', title: 'Obiezioni più frequenti',       sub: 'Cosa dicono per non comprare o non fissare',           color: 'red' },
  { id: 'obiettivi',    icon: '🎯', title: 'Obiettivi più frequenti',       sub: 'Cosa vogliono ottenere',                                color: 'green' },
  { id: 'perche-num',   icon: '📱', title: 'Perché hanno lasciato il numero', sub: 'Il motivo che li ha portati a chiedere la chiamata',  color: 'blue' },
  { id: 'perche-no',    icon: '🧱', title: 'Perché alla fine non comprano', sub: 'Il motivo vero, oltre le parole di circostanza',       color: 'rose' },
  { id: 'difficolta',   icon: '🧩', title: 'Difficoltà operative',          sub: 'Dove si bloccano nel quotidiano',                       color: 'orange' },
  { id: 'cercano',      icon: '🔍', title: 'Cosa cercano',                  sub: 'Cosa si aspettano da un metodo',                        color: 'green' },
  { id: 'paure',        icon: '😨', title: 'Paure',                         sub: 'Timori sull’università, sul futuro, sul metodo',   color: 'purple' },
  { id: 'star-male',    icon: '💔', title: 'Cosa li fa stare male',         sub: 'Il dolore di oggi, con le loro parole',                 color: 'red' },
  { id: 'sogni',        icon: '🌙', title: 'I loro sogni',                  sub: 'Oltre gli esami: cosa vogliono dalla vita',             color: 'purple' },
  { id: 'piace',        icon: '💡', title: 'Cosa gli piace del metodo',     sub: 'Perché Metodo li ha convinti o incuriositi',            color: 'green' }
];

function renderCopyTV() {
  const coaches = (state.data && state.data.config && state.data.config.coaches) || [];
  const today = new Date().toLocaleDateString('it-IT');

  return `
    <section>
      <div class="copy-hero">
        <div class="copy-hero-label">📝 COPY TV</div>
        <div class="copy-hero-main">
          <div class="copy-hero-num">0</div>
          <div class="copy-hero-text">
            <b>chiamate ascoltate</b> · quello che dicono i clienti, in classifica
            <div class="copy-hero-sub">Nessuna analisi disponibile · in attesa di collegare le trascrizioni</div>
          </div>
          <div class="copy-hero-actions">
            <button class="copy-btn copy-btn-primary" disabled>Scarica per il copywriter (Word)</button>
            <button class="copy-btn copy-btn-ghost" disabled>Testo semplice</button>
          </div>
        </div>
      </div>

      <div class="copy-filters">
        <div class="copy-filters-row">
          <span class="copy-filters-label">RIFALLA CON</span>
          <div class="copy-filter-group">
            <button class="copy-pill active" disabled>Tutte le chiamate</button>
            <button class="copy-pill" disabled>Ultimi 12 mesi</button>
            <button class="copy-pill" disabled>Ultimi 6 mesi</button>
            <button class="copy-pill" disabled>Ultimi 3 mesi</button>
          </div>
          <div class="copy-filter-group">
            <button class="copy-pill active" disabled>Tutti</button>
            ${coaches.map(c => `<button class="copy-pill" disabled>${esc(c)}</button>`).join('')}
          </div>
          <div class="copy-filter-group">
            <button class="copy-pill active" disabled>Prenotazioni e check-up</button>
            <button class="copy-pill" disabled>Solo prenotazioni</button>
            <button class="copy-pill" disabled>Solo check-up</button>
          </div>
        </div>
        <div class="copy-filters-cta">
          <button class="copy-btn copy-btn-dark" disabled>Rifai le classifiche</button>
          <span class="copy-hint">In arrivo — richiede trascrizioni delle chiamate collegate</span>
        </div>
      </div>

      <div class="copy-card copy-cliente">
        <div class="copy-card-label red">🙋 IL CLIENTE TIPO</div>
        <div class="copy-empty-para">
          Qui apparirà il profilo del cliente tipo — una descrizione sintetica basata sull'analisi
          delle chiamate (chi è, cosa fa, perché ha chiesto il check-up, cosa lo frustra, cosa cerca).
        </div>
      </div>

      <div class="copy-grid">
        ${COPY_BLOCKS.map(b => renderCopyBlock(b)).join('')}
      </div>

      <div class="copy-card copy-parole">
        <div class="copy-block-head">
          <div class="copy-block-ico">💬</div>
          <div>
            <div class="copy-block-title">Le loro parole, pari pari</div>
            <div class="copy-block-sub">Frasi dette davvero dai clienti, buone per annunci e pagine</div>
          </div>
        </div>
        <div class="copy-quotes-grid">
          ${Array.from({ length: 9 }).map(() => `<div class="copy-quote-empty">«…»</div>`).join('')}
        </div>
      </div>

      <div class="copy-footer">Archivio non ancora generato · oggi è ${today}</div>
    </section>
  `;
}

function renderCopyBlock(b) {
  return `
    <div class="copy-card copy-block copy-${b.color}">
      <div class="copy-block-head">
        <div class="copy-block-ico">${b.icon}</div>
        <div>
          <div class="copy-block-title">${b.title}</div>
          <div class="copy-block-sub">${b.sub}</div>
        </div>
      </div>
      <div class="copy-block-items">
        ${[1,2,3,4].map(n => `
          <div class="copy-item">
            <div class="copy-item-row">
              <span class="copy-item-num">${n}</span>
              <span class="copy-item-title">—</span>
              <span class="copy-item-count">0 su 0</span>
            </div>
            <div class="copy-item-bar"><div class="copy-item-bar-fill" style="width:0%"></div></div>
          </div>
        `).join('')}
      </div>
      <div class="copy-block-empty">Nessuna analisi disponibile</div>
    </div>
  `;
}

function bindContent() {
  $$('.coach-sub').forEach(b => b.addEventListener('click', () => {
    state.coachSubView = b.dataset.sub;
    render();
  }));
}

// ─────────────── PERIOD PILLS / DATE PICKERS ───────────────

function updatePeriodChip() {
  // Sincronizza i date picker con il periodo del foglio (sempre, non solo se vuoti)
  const sp = sheetPeriod();
  if (sp) {
    const df = $('#dateFrom'), dt = $('#dateTo');
    if (df) df.value = sp.from;
    if (dt) dt.value = sp.to;
    syncActivePill(sp.from, sp.to);
  }
}

// Attiva il pill che corrisponde al range (altrimenti nessuno)
function syncActivePill(from, to) {
  const pills = $$('.pill');
  pills.forEach(x => x.classList.remove('active'));
  for (const b of pills) {
    const id = b.dataset.period;
    if (id === 'sheet') continue;
    const range = periodFromPill(id);
    if (range && range[0] === from && range[1] === to) {
      b.classList.add('active');
      return;
    }
  }
  // Nessuno dei preset corrisponde → attivo il pill "sheet"
  const sheetPill = pills.find ? pills.find(p => p.dataset.period === 'sheet') : null;
  if (sheetPill) sheetPill.classList.add('active');
  else {
    for (const b of pills) if (b.dataset.period === 'sheet') { b.classList.add('active'); break; }
  }
}

$$('.pill').forEach(b => b.addEventListener('click', async () => {
  if (state.periodBusy) return;
  const id = b.dataset.period;
  if (id === 'sheet') {
    $$('.pill').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    await fetchData();
    render();
    return;
  }
  const range = periodFromPill(id);
  if (!range) return;
  $$('.pill').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  // Allinea date picker e invia al foglio
  $('#dateFrom').value = range[0];
  $('#dateTo').value = range[1];
  await applyPeriodToSheet(range[0], range[1]);
}));

$('#dateFrom').addEventListener('change', async (e) => {
  const from = e.target.value, to = $('#dateTo').value;
  if (!from || !to) return;
  $$('.pill').forEach(x => x.classList.remove('active'));
  await applyPeriodToSheet(from, to);
});
$('#dateTo').addEventListener('change', async (e) => {
  const to = e.target.value, from = $('#dateFrom').value;
  if (!from || !to) return;
  $$('.pill').forEach(x => x.classList.remove('active'));
  await applyPeriodToSheet(from, to);
});

$('#refreshBtn').addEventListener('click', async () => { await fetchData(); render(); });
$('#logoutBtn').addEventListener('click', doLogout);

// ─────────────── TOAST ───────────────

let toastT = null;
function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

// ─────────────── BOOTSTRAP ───────────────

async function boot() {
  const user = await checkAuth();
  if (user) {
    state.currentUser = user;
    showApp();
    await fetchData();
    render();
  } else {
    showLogin();
  }
}
boot();
