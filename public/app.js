// ═══════════ SALES TV — Metodo Regina ═══════════

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const OBIETTIVO_COACH = 25000; // per coach al mese

const CHANNEL_META = {
  'Queen Challenge': { icon: '👑' },
  'Quiz': { icon: '❓' },
  'Sales': { icon: '📞' },
  'Assistenza': { icon: '💬' },
  'Manuale': { icon: '📖' }
};

const state = {
  data: null,
  period: "thisMonth",
  dateFrom: null,
  dateTo: null,
  activeTab: 'home',
  currentUser: null
};

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

// ─────────────── DATA ───────────────

async function fetchData() {
  const r = await fetch('/api/data', { credentials: 'include' });
  if (!r.ok) { toast('Errore caricamento dati', 'error'); throw new Error('fetch fail'); }
  const d = await r.json();
  state.data = d;
  toast(`Dati aggiornati · ${d.vendite.length} vendite · ${d.checkup.length} check-up`);
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
    default: return [firstOfMonthISO(0), lastOfMonthISO(0)];
  }
}
function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

// ─────────────── AGGREGATION ───────────────

function aggregateFor(coach) {
  if (!state.data) return null;
  const [from, to] = computePeriodRange();
  const [prevFrom, prevTo] = shiftRange(from, to, -1);

  let vendite = state.data.vendite;
  let checkup = state.data.checkup;
  if (coach && coach !== '__ALL__') {
    vendite = vendite.filter(v => v.coach === coach);
    checkup = checkup.filter(c => c.coach === coach);
  }

  const vendPeriod = vendite.filter(v => inRange(v.dataVendita, from, to));
  const incPeriod = vendite.filter(v => inRange(v.dataIncasso, from, to));
  const cuProspect = checkup.filter(c => inRange(c.dataProspect, from, to));
  const cuFatti = checkup.filter(c => inRange(c.dataCheckup, from, to) && String(c.checkupStato).toUpperCase() === 'FATTO');
  const chiamati = checkup.filter(c => inRange(c.dataProspect, from, to) && c.setting);

  const fatt = vendPeriod.reduce((a, v) => a + v.importo, 0);
  const inc = incPeriod.reduce((a, v) => a + v.importo, 0);
  const daLeadPrecedenti = vendite.filter(v => inRange(v.dataProspect, prevFrom, prevTo) && inRange(v.dataIncasso, from, to)).reduce((a, v) => a + v.importo, 0);

  // Confronto periodo precedente
  const vendPrev = vendite.filter(v => inRange(v.dataVendita, prevFrom, prevTo));
  const incPrev = vendite.filter(v => inRange(v.dataIncasso, prevFrom, prevTo));
  const fattPrev = vendPrev.reduce((a, v) => a + v.importo, 0);
  const incPrev_ = incPrev.reduce((a, v) => a + v.importo, 0);

  return {
    from, to,
    vendPeriod, incPeriod, cuProspect, cuFatti, chiamati,
    fatt, inc, fattPrev, incPrev: incPrev_, daLeadPrecedenti,
    trendFatt: fattPrev ? ((fatt - fattPrev) / fattPrev) * 100 : 0,
    trendInc: incPrev_ ? ((inc - incPrev_) / incPrev_) * 100 : 0,
    prospect: cuProspect.length,
    vendite: vendPeriod.length,
    checkup: cuFatti.length,
    ticketMedio: vendPeriod.length ? fatt / vendPeriod.length : 0,
    rop: cuProspect.length ? Math.round(fatt / cuProspect.length) : 0,
    ropTarget: 400,
    roc: chiamati.length ? Math.round(fatt / chiamati.length) : 0
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
  const set = new Set();
  state.data.vendite.forEach(v => { if (v.coach) set.add(v.coach); });
  state.data.checkup.forEach(c => { if (c.coach) set.add(c.coach); });
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
}

function renderTabs() {
  const coaches = activeCoaches();
  const tabs = [
    { id: 'home', label: '🏠 Home' },
    ...coaches.map(c => ({ id: 'coach:' + c, label: c, badge: null, avatar: c[0].toUpperCase() }))
  ];
  $('#tabs').innerHTML = tabs.map(t => `
    <button class="tab ${state.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
      ${t.avatar ? `<span class="tab-avatar">${t.avatar}</span>` : ''}
      <span>${t.label}</span>
      ${t.badge ? `<span class="tab-badge">${t.badge}</span>` : ''}
    </button>
  `).join('');
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    state.activeTab = b.dataset.tab;
    render();
  }));
}

function renderContent() {
  const isHome = state.activeTab === 'home';
  const coach = isHome ? null : state.activeTab.replace('coach:', '');
  const html = isHome ? renderHome() : renderCoachDetail(coach);
  $('#viewContent').innerHTML = html;
  bindContent();
}

function renderHome() {
  const agg = aggregateFor(null);
  const coaches = activeCoaches();
  const totObiettivo = coaches.length * OBIETTIVO_COACH || OBIETTIVO_COACH;
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
        <span><span class="dot" style="background:#10b981"></span>Fatturato e vendite</span>
        <span><span class="dot" style="background:#06b6d4"></span>Incassato</span>
        <span><span class="dot" style="background:#f97316"></span>Contatti</span>
        <span><span class="dot" style="background:#a855f7"></span>Check-up</span>
      </div>

      <div class="team-grid">
        <div class="team-card">
          <div class="donut">
            ${donutSVG(pctObj)}
            <div class="donut-center">
              <div class="donut-label">Obiettivo</div>
              <div class="donut-value">${fmtPctInt(pctObj)}</div>
              <div class="donut-sub">di ${fmtEur(totObiettivo)}</div>
            </div>
          </div>
          <div class="team-info">
            <div class="info-label">Mancano</div>
            <div class="info-value">${fmtEur(mancano)}</div>
            <div class="info-sub">Circa <b>${stimaVendite} vendite</b> entro il ${dayEnd} ${monthName}</div>
            <div class="info-hint">dove si arriva oggi a ritmo costante</div>
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
          <div class="roc-badge">
            <div class="roc-label">ROC</div>
            <div class="roc-value">${fmtEur(agg.roc)}</div>
            <div class="roc-sub">per chiamato</div>
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

    <!-- SEZIONE 2: VENDITORI -->
    <section>
      <div class="section-label purple">Venditori</div>
      <div class="section-title">${coaches.join(' e ')}</div>
      <div class="section-sub">Performance per coach</div>
      <div class="venditori-grid">
        ${coaches.map(c => renderVenditoreCard(c)).join('')}
      </div>
    </section>

    <!-- SEZIONE 3: CANALI -->
    <section>
      <div class="section-label cyan">Canali</div>
      <div class="section-title">Da dove arrivano le vendite</div>
      <div class="section-sub">Breakdown per funnel</div>
      <div class="canali-grid">
        ${renderCanali()}
      </div>
    </section>

    <!-- SEZIONE 4: PRODOTTI -->
    <section>
      <div class="section-label pink">Prodotti</div>
      <div class="section-title">Cosa si vende</div>
      <div class="prodotti-card">
        ${renderProdotti()}
      </div>
      <div class="footer-note">
        Fatturato = vendite fatte nel periodo. Incassato = soldi arrivati nel periodo. Le frecce confrontano con il periodo precedente.
      </div>
    </section>
  `;
}

function renderVenditoreCard(coach) {
  const agg = aggregateFor(coach);
  const pctObj = OBIETTIVO_COACH ? (agg.fatt / OBIETTIVO_COACH) * 100 : 0;
  const mancano = Math.max(0, OBIETTIVO_COACH - agg.fatt);
  const stimaVendite = agg.ticketMedio ? Math.ceil(mancano / agg.ticketMedio) : 0;
  const chiusura = agg.cuFatti.length ? (agg.vendite / agg.cuFatti.length) * 100 : 0;
  const daChiamare = agg.cuProspect.filter(c => !c.setting).length;

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
            <div class="s">${fmtPctInt(pctObj)} di ${fmtEur(OBIETTIVO_COACH)}</div>
          </div>
        </div>
        <div class="venditore-quad">
          <div class="mini-metric cyan">
            <div class="l"><span class="dot" style="background:#06b6d4"></span>Incassato</div>
            <div class="v">${fmtEur(agg.inc)}</div>
          </div>
          <div class="mini-metric purple">
            <div class="l"><span class="dot" style="background:#a855f7"></span>Mese prec.</div>
            <div class="v">${fmtEur(agg.daLeadPrecedenti)}</div>
          </div>
          <div class="mini-metric green">
            <div class="l"><span class="dot" style="background:#10b981"></span>Chiusura</div>
            <div class="v">${fmtPctInt(chiusura)}</div>
          </div>
          <div class="mini-metric">
            <div class="l"><span class="dot" style="background:#eab308"></span>ROP</div>
            <div class="v">${fmtEur(agg.rop)}</div>
          </div>
        </div>
      </div>

      <div class="venditore-mancano">
        Per l'obiettivo mancano <b>${fmtEur(mancano)}</b>, circa <b>${stimaVendite} vendite</b>
      </div>
    </div>
  `;
}

function renderCanali() {
  const funnels = state.data.config.funnels;
  return funnels.map(fn => {
    const [from, to] = computePeriodRange();
    const vs = state.data.vendite.filter(v => v.funnel === fn && inRange(v.dataVendita, from, to));
    const cs = state.data.checkup.filter(c => c.funnel === fn && inRange(c.dataProspect, from, to));
    const csFatti = cs.filter(c => String(c.checkupStato).toUpperCase() === 'FATTO' && inRange(c.dataCheckup, from, to));
    const fatt = vs.reduce((a, v) => a + v.importo, 0);
    const rop = cs.length ? Math.round(fatt / cs.length) : 0;
    const contatti = cs.length;
    const maxContatti = Math.max(1, ...funnels.map(f => state.data.checkup.filter(c => c.funnel === f && inRange(c.dataProspect, from, to)).length));
    const barW = (contatti / maxContatti) * 100;
    const meta = CHANNEL_META[fn] || { icon: '📦' };
    return `
      <div class="canale-card">
        <div class="canale-head">
          <div class="canale-left">
            <div class="canale-icon">${meta.icon}</div>
            <div>
              <div class="canale-name">${fn}</div>
              <div class="canale-meta">${contatti} contatti · ${csFatti.length} check-up</div>
            </div>
          </div>
          <div class="canale-right">
            <div class="canale-fatt">${fmtEur(fatt)}</div>
            <div class="canale-sub">${vs.length} vendite · ROP <b>${fmtEur(rop)}</b></div>
          </div>
        </div>
        <div class="canale-bar"><div class="canale-bar-fill" style="width:${barW}%"></div></div>
      </div>
    `;
  }).join('');
}

function renderProdotti() {
  const [from, to] = computePeriodRange();
  const vs = state.data.vendite.filter(v => inRange(v.dataVendita, from, to));
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
        <div class="prodotto-name">${name}</div>
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
  const pctObj = OBIETTIVO_COACH ? (agg.fatt / OBIETTIVO_COACH) * 100 : 0;
  const mancano = Math.max(0, OBIETTIVO_COACH - agg.fatt);
  const stimaVendite = agg.ticketMedio ? Math.ceil(mancano / agg.ticketMedio) : 0;
  const chiusura = agg.cuFatti.length ? (agg.vendite / agg.cuFatti.length) * 100 : 0;
  const dayEnd = agg.to.split('-')[2];
  const monthName = new Date(agg.to).toLocaleDateString('it-IT', { month: 'long' });

  // Vendite recenti coach
  const vendite = state.data.vendite
    .filter(v => v.coach === coach && inRange(v.dataVendita, agg.from, agg.to))
    .sort((a, b) => (b.dataVendita || '').localeCompare(a.dataVendita || ''));

  return `
    <section>
      <div class="section-label">Obiettivo</div>
      <div class="section-title">${coach} nel periodo</div>
      <div class="section-sub">Performance individuale</div>

      <div class="team-grid">
        <div class="team-card">
          <div class="donut">
            ${donutSVG(pctObj)}
            <div class="donut-center">
              <div class="donut-label">Obiettivo</div>
              <div class="donut-value">${fmtPctInt(pctObj)}</div>
              <div class="donut-sub">di ${fmtEur(OBIETTIVO_COACH)}</div>
            </div>
          </div>
          <div class="team-info">
            <div class="info-label">Mancano</div>
            <div class="info-value">${fmtEur(mancano)}</div>
            <div class="info-sub">Circa <b>${stimaVendite} vendite</b> entro il ${dayEnd} ${monthName}</div>
          </div>
        </div>

        <div class="rop-card">
          <div class="rop-header">ROP · Resa per contatto</div>
          <div class="rop-main">
            <div class="rop-value">${fmtEur(agg.rop)}</div>
            ${trendChip(agg.rop ? ((agg.rop - agg.ropTarget) / agg.ropTarget) * 100 : 0)}
          </div>
          <div class="rop-sub">${fmtEur(agg.fatt)} di fatturato su ${agg.prospect} contatti · obiettivo <b>${fmtEur(agg.ropTarget)}</b></div>
          <div class="rop-note">Chiusura: <b style="color:#eab308">${fmtPctInt(chiusura)}</b> · Vendita media: <b>${fmtEur(agg.ticketMedio)}</b> · ROC per chiamato: <b>${fmtEur(agg.roc)}</b></div>
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
          <div class="m-value">${fmtNum(agg.chiamati.length)}</div>
          <div class="m-sub">${agg.prospect} prospect · ${agg.checkup} check-up fatti</div>
        </div>
      </div>
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

function bindContent() {
  // niente da bindare per ora
}

// ─────────────── PERIOD PILLS & OTHER ───────────────

$$('.pill').forEach(b => b.addEventListener('click', () => {
  $$('.pill').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.period = b.dataset.period;
  render();
}));
$('#dateFrom').addEventListener('change', e => { state.dateFrom = e.target.value; state.period = 'custom'; $$('.pill').forEach(x => x.classList.remove('active')); render(); });
$('#dateTo').addEventListener('change', e => { state.dateTo = e.target.value; state.period = 'custom'; $$('.pill').forEach(x => x.classList.remove('active')); render(); });
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
