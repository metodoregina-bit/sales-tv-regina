// ═══════════ SALES TV — Metodo Regina ═══════════

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const state = {
  data: null,
  period: "thisMonth",
  dateFrom: null,
  dateTo: null,
  view: "dashboard",
  checkupSub: "all"
};

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

// ─────────────── DATA ───────────────

async function fetchData() {
  toast('Caricamento dati...');
  const r = await fetch('/api/data', { credentials: 'include' });
  if (!r.ok) { toast('Errore caricamento dati', 'error'); throw new Error('fetch fail'); }
  const d = await r.json();
  state.data = d;
  toast(`Dati aggiornati · ${d.vendite.length} vendite · ${d.checkup.length} check-up`);
  render();
}

// ─────────────── FILTRO PERIODO ───────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
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
    case 'today': return [today, today];
    case '7d': return [daysAgoISO(6), today];
    case '30d': return [daysAgoISO(29), today];
    case 'thisMonth': return [firstOfMonthISO(0), lastOfMonthISO(0)];
    case 'lastMonth': return [firstOfMonthISO(-1), lastOfMonthISO(-1)];
    case 'ytd': return [`${new Date().getFullYear()}-01-01`, today];
    case 'all': return ['1970-01-01', '9999-12-31'];
    case 'custom': return [state.dateFrom || '1970-01-01', state.dateTo || '9999-12-31'];
    default: return ['1970-01-01', '9999-12-31'];
  }
}

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

// ─────────────── AGGREGAZIONE ───────────────

function aggregate() {
  if (!state.data) return null;
  const [from, to] = computePeriodRange();
  const [prevFrom, prevTo] = [firstOfMonthISO(-1), lastOfMonthISO(-1)];

  const vendite = state.data.vendite;
  const checkup = state.data.checkup;

  // Vendite nel periodo (per data vendita)
  const venditeInPeriod = vendite.filter(v => inRange(v.dataVendita, from, to));
  // Vendite incassate nel periodo (per data incasso)
  const incassateInPeriod = vendite.filter(v => inRange(v.dataIncasso, from, to));
  // Mese precedente incassate nel periodo (prospect mese prec, vendita ora)
  const mesePrec = vendite.filter(v => inRange(v.dataProspect, prevFrom, prevTo) && inRange(v.dataVendita, from, to));

  // Check-up nel periodo
  const checkupProspect = checkup.filter(c => inRange(c.dataProspect, from, to));
  const checkupFatti = checkup.filter(c => inRange(c.dataCheckup, from, to) && String(c.checkupStato).toUpperCase() === 'FATTO');
  const chiamati = checkup.filter(c => inRange(c.dataProspect, from, to) && c.setting);

  const totFattCassa = incassateInPeriod.reduce((a, v) => a + v.importo, 0);
  const totFattComp = venditeInPeriod.reduce((a, v) => a + v.importo, 0);
  const totFattMesePrec = mesePrec.reduce((a, v) => a + v.importo, 0);

  return {
    period: [from, to],
    kpi: {
      prospect: checkupProspect.length,
      chiamati: chiamati.length,
      checkupFatti: checkupFatti.length,
      vendite: venditeInPeriod.length,
      fattCassa: totFattCassa,
      fattComp: totFattComp,
      fattMesePrec: totFattMesePrec,
      pctCheckup: checkupProspect.length ? (checkupFatti.length / checkupProspect.length) * 100 : 0,
      pctConv: checkupFatti.length ? (venditeInPeriod.length / checkupFatti.length) * 100 : 0,
      medioVendita: venditeInPeriod.length ? totFattComp / venditeInPeriod.length : 0
    },
    lists: { venditeInPeriod, incassateInPeriod, checkupProspect, checkupFatti, chiamati }
  };
}

function aggregateByCoach() {
  const agg = aggregate();
  if (!agg) return [];
  const [from, to] = agg.period;
  const coaches = state.data.config.coaches.filter(c => c && c !== '');
  return coaches.map(coach => {
    const vs = state.data.vendite.filter(v => v.coach === coach && inRange(v.dataVendita, from, to));
    const cs = state.data.checkup.filter(c => c.coach === coach && inRange(c.dataProspect, from, to));
    const csFatti = cs.filter(c => String(c.checkupStato).toUpperCase() === 'FATTO' && inRange(c.dataCheckup, from, to));
    const chiam = cs.filter(c => c.setting);
    const fatt = vs.reduce((a, v) => a + v.importo, 0);
    return {
      coach,
      prospect: cs.length,
      chiamati: chiam.length,
      checkup: csFatti.length,
      vendite: vs.length,
      fatturato: fatt,
      pctConv: csFatti.length ? (vs.length / csFatti.length) * 100 : 0
    };
  }).sort((a, b) => b.fatturato - a.fatturato);
}

function aggregateByFunnel() {
  const agg = aggregate();
  if (!agg) return [];
  const [from, to] = agg.period;
  return state.data.config.funnels.map(fn => {
    const vs = state.data.vendite.filter(v => v.funnel === fn && inRange(v.dataVendita, from, to));
    const cs = state.data.checkup.filter(c => c.funnel === fn && inRange(c.dataProspect, from, to));
    const csFatti = cs.filter(c => String(c.checkupStato).toUpperCase() === 'FATTO' && inRange(c.dataCheckup, from, to));
    const fatt = vs.reduce((a, v) => a + v.importo, 0);
    return {
      funnel: fn,
      prospect: cs.length,
      checkup: csFatti.length,
      vendite: vs.length,
      fatturato: fatt,
      pctConv: csFatti.length ? (vs.length / csFatti.length) * 100 : 0
    };
  });
}

// ─────────────── FORMAT ───────────────

const fmtEur = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtNum = v => new Intl.NumberFormat('it-IT').format(v);
const fmtPct = v => v.toFixed(1) + '%';
const fmtDate = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

// ─────────────── RENDER KPI CARDS ───────────────

function kpiCard(label, value, sub = '', color = 'blue') {
  return `<div class="kpi-card kpi-${color}">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`;
}

function renderDashboard() {
  const agg = aggregate();
  if (!agg) return;
  const k = agg.kpi;

  $('#kpiGenerali').innerHTML = [
    kpiCard('PROSPECT', fmtNum(k.prospect), 'Nel periodo', 'blue'),
    kpiCard('CHIAMATI', fmtNum(k.chiamati), `${k.prospect ? ((k.chiamati / k.prospect) * 100).toFixed(0) : 0}% dei prospect`, 'purple'),
    kpiCard('CHECK-UP', fmtNum(k.checkupFatti), fmtPct(k.pctCheckup) + ' dei prospect', 'orange'),
    kpiCard('VENDITE', fmtNum(k.vendite), fmtPct(k.pctConv) + ' dei check-up', 'green')
  ].join('');

  $('#kpiFatturato').innerHTML = [
    kpiCard('FATT. PER CASSA', fmtEur(k.fattCassa), 'Incassato nel periodo', 'green'),
    kpiCard('FATT. X COMP.', fmtEur(k.fattComp), 'Venduto nel periodo', 'blue'),
    kpiCard('FATT. MESE PREC.', fmtEur(k.fattMesePrec), 'Prospect prec. venduti ora', 'purple'),
    kpiCard('VENDITA MEDIA', fmtEur(k.medioVendita), 'Ticket medio', 'orange')
  ].join('');

  $('#kpiConversioni').innerHTML = [
    kpiCard('% CHECK-UP', fmtPct(k.pctCheckup), 'Effettuati / Prospect', 'blue'),
    kpiCard('% CONVERSIONE', fmtPct(k.pctConv), 'Vendite / Check-up', 'green'),
    kpiCard('PROSPECT → VENDITA', k.prospect ? fmtPct((k.vendite / k.prospect) * 100) : '0.0%', 'Conversione totale', 'purple'),
    kpiCard('SETTING RATE', k.prospect ? fmtPct((k.chiamati / k.prospect) * 100) : '0.0%', 'Chiamati / Prospect', 'orange')
  ].join('');
}

function renderCoach() {
  const rows = aggregateByCoach();
  const t = $('#coachTable');
  t.innerHTML = `<thead><tr>
    <th>Coach</th>
    <th class="num">Prospect</th>
    <th class="num">Chiamati</th>
    <th class="num">Check-up</th>
    <th class="num">Vendite</th>
    <th class="num">Fatturato</th>
    <th class="num">% Conv</th>
  </tr></thead><tbody>${
    rows.map(r => `<tr>
      <td><b>${r.coach}</b></td>
      <td class="num">${fmtNum(r.prospect)}</td>
      <td class="num">${fmtNum(r.chiamati)}</td>
      <td class="num">${fmtNum(r.checkup)}</td>
      <td class="num">${fmtNum(r.vendite)}</td>
      <td class="num"><b>${fmtEur(r.fatturato)}</b></td>
      <td class="num">${fmtPct(r.pctConv)}</td>
    </tr>`).join('')
  }</tbody>`;
}

function renderFunnel() {
  const rows = aggregateByFunnel();
  $('#funnelCards').innerHTML = rows.map(r => `
    <div class="kpi-card kpi-purple">
      <div class="kpi-label">${r.funnel}</div>
      <div class="kpi-value">${fmtEur(r.fatturato)}</div>
      <div class="kpi-sub">${r.vendite} vendite · ${r.checkup} check-up · ${fmtPct(r.pctConv)}</div>
    </div>
  `).join('');
  const t = $('#funnelTable');
  t.innerHTML = `<thead><tr>
    <th>Funnel</th>
    <th class="num">Prospect</th>
    <th class="num">Check-up</th>
    <th class="num">Vendite</th>
    <th class="num">Fatturato</th>
    <th class="num">% Conv</th>
  </tr></thead><tbody>${
    rows.map(r => `<tr>
      <td><b>${r.funnel}</b></td>
      <td class="num">${fmtNum(r.prospect)}</td>
      <td class="num">${fmtNum(r.checkup)}</td>
      <td class="num">${fmtNum(r.vendite)}</td>
      <td class="num"><b>${fmtEur(r.fatturato)}</b></td>
      <td class="num">${fmtPct(r.pctConv)}</td>
    </tr>`).join('')
  }</tbody>`;
}

function renderVendite() {
  const agg = aggregate();
  if (!agg) return;
  const [from, to] = agg.period;
  const rows = state.data.vendite
    .filter(v => inRange(v.dataVendita, from, to))
    .sort((a, b) => (b.dataVendita || '').localeCompare(a.dataVendita || ''));
  const t = $('#venditeTable');
  t.innerHTML = `<thead><tr>
    <th>Data</th>
    <th>Cliente</th>
    <th>Email</th>
    <th>Coach</th>
    <th>Prodotto</th>
    <th>Funnel</th>
    <th class="num">Importo</th>
    <th>Data incasso</th>
  </tr></thead><tbody>${
    rows.map(v => `<tr>
      <td>${fmtDate(v.dataVendita)}</td>
      <td>${v.nome} ${v.cognome}</td>
      <td>${v.email}</td>
      <td>${v.coach}</td>
      <td>${v.prodotto}</td>
      <td>${v.funnel}</td>
      <td class="num"><b>${fmtEur(v.importo)}</b></td>
      <td>${fmtDate(v.dataIncasso)}</td>
    </tr>`).join('') || `<tr><td colspan="8" class="empty">Nessuna vendita nel periodo</td></tr>`
  }</tbody>`;
}

function renderCheckup() {
  const agg = aggregate();
  if (!agg) return;
  const [from, to] = agg.period;
  let rows = state.data.checkup.filter(c => inRange(c.dataProspect, from, to));
  if (state.checkupSub !== 'all') rows = rows.filter(c => c.funnel === state.checkupSub);
  rows.sort((a, b) => (b.dataProspect || '').localeCompare(a.dataProspect || ''));
  const t = $('#checkupTable');
  t.innerHTML = `<thead><tr>
    <th>Data prospect</th>
    <th>Cliente</th>
    <th>Funnel</th>
    <th>Coach</th>
    <th>SET</th>
    <th>Data check-up</th>
    <th>Stato</th>
    <th>VEND</th>
    <th>Prodotto</th>
    <th class="num">Importo</th>
  </tr></thead><tbody>${
    rows.map(c => `<tr>
      <td>${fmtDate(c.dataProspect)}</td>
      <td>${c.nome} ${c.cognome}</td>
      <td>${c.funnel}</td>
      <td>${c.coach}</td>
      <td>${c.setting ? '✅' : ''}</td>
      <td>${fmtDate(c.dataCheckup)}</td>
      <td>${c.checkupStato}</td>
      <td>${c.venduto ? '💰' : ''}</td>
      <td>${c.prodottoVenduto}</td>
      <td class="num">${c.importo ? fmtEur(c.importo) : ''}</td>
    </tr>`).join('') || `<tr><td colspan="10" class="empty">Nessun check-up nel periodo</td></tr>`
  }</tbody>`;
}

function renderImpostazioni(user) {
  if (!state.data) return;
  $('#settingSheetId').textContent = state.data.config.sheetId;
  $('#settingSheetLink').href = state.data.config.sheetUrl;
  $('#settingUpdated').textContent = new Date(state.data.updatedAt).toLocaleString('it-IT');
  $('#settingUser').textContent = user || '—';
}

// ─────────────── RENDER MAIN ───────────────

function render() {
  if (!state.data) return;
  const titles = {
    dashboard: ['Dashboard', 'Panoramica del team vendita'],
    coach: ['Coach', 'Classifica performance per coach'],
    funnel: ['Funnel', 'Breakdown per funnel di vendita'],
    vendite: ['Vendite', 'Vendite Regina — lista completa'],
    checkup: ['Check-up', 'Check-up prenotati/effettuati'],
    impostazioni: ['Impostazioni', 'Configurazione fonte dati']
  };
  const [t, s] = titles[state.view] || ['', ''];
  $('#pageTitle').textContent = t;
  $('#pageSub').textContent = s;

  $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === state.view));
  $$('.nav-item').forEach(v => v.classList.toggle('active', v.dataset.view === state.view));

  renderDashboard();
  if (state.view === 'coach') renderCoach();
  if (state.view === 'funnel') renderFunnel();
  if (state.view === 'vendite') renderVendite();
  if (state.view === 'checkup') renderCheckup();
  if (state.view === 'impostazioni') renderImpostazioni(state.currentUser);
}

// ─────────────── TOAST ───────────────

let toastT = null;
function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

// ─────────────── EVENT BINDING ───────────────

function bindEvents() {
  $$('.nav-item').forEach(n => n.addEventListener('click', e => {
    e.preventDefault();
    state.view = n.dataset.view;
    render();
  }));
  $$('.period-tab').forEach(b => b.addEventListener('click', () => {
    $$('.period-tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.period = b.dataset.period;
    render();
  }));
  $('#refreshBtn').addEventListener('click', fetchData);
  $('#logoutBtn').addEventListener('click', doLogout);
  $('#themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const nxt = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nxt);
    localStorage.setItem('stv_theme', nxt);
  });
  $('#dateFrom').addEventListener('change', e => { state.dateFrom = e.target.value; state.period = 'custom'; render(); });
  $('#dateTo').addEventListener('change', e => { state.dateTo = e.target.value; state.period = 'custom'; render(); });
  $$('.sub-tab').forEach(b => b.addEventListener('click', () => {
    $$('.sub-tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.checkupSub = b.dataset.sub;
    renderCheckup();
  }));
}

// ─────────────── BOOTSTRAP ───────────────

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

// Bind login form SUBITO (fuori da async) per garantire che preventDefault funzioni
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  e.stopPropagation();
  $('#loginError').textContent = '';
  try {
    const u = await doLogin($('#loginEmail').value, $('#loginPass').value);
    state.currentUser = u;
    showApp();
    bindEvents();
    await fetchData();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
  return false;
});

async function boot() {
  // Theme
  const savedTheme = localStorage.getItem('stv_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const user = await checkAuth();
  if (user) {
    state.currentUser = user;
    showApp();
    bindEvents();
    await fetchData();
  } else {
    showLogin();
  }
}

boot();
