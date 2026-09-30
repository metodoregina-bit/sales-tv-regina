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
  period: "all",
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

function aggregateFor(coach) {
  if (!state.data) return null;
  const [from, to] = computePeriodRange();
  const [prevFrom, prevTo] = shiftRange(from, to, -1);

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

  const fatt = vendPeriod.reduce((a, v) => a + v.importo, 0);
  const inc = incPeriod.reduce((a, v) => a + v.importo, 0);
  const daLeadPrecedenti = vendite.filter(v => inRange(v.dataProspect, prevFrom, prevTo) && inRange(v.dataIncasso, from, to)).reduce((a, v) => a + v.importo, 0);

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
    { label: 'Prospect', value: agg.prospect, color: '#3b82f6', pctOf: null },
    { label: 'Chiamati', value: agg.chiamati.length, color: '#a855f7', pctOf: agg.prospect },
    { label: 'Check-up', value: agg.checkup, color: '#f97316', pctOf: agg.chiamati.length },
    { label: 'Vendite', value: agg.vendite, color: '#10b981', pctOf: agg.checkup }
  ];
  const max = Math.max(1, agg.prospect);
  return `
    <div class="prodotti-card">
      <div style="display:flex;align-items:flex-end;gap:16px;padding:20px 0">
        ${steps.map(s => {
          const w = (s.value / max) * 100;
          const pct = s.pctOf ? Math.round((s.value / s.pctOf) * 100) : null;
          return `
            <div style="flex:1;text-align:center">
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:8px">${s.label}</div>
              <div style="font-size:32px;font-weight:800;color:${s.color};line-height:1">${s.value}</div>
              ${pct !== null ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">${pct}% del passo prima</div>` : `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">Totale</div>`}
              <div style="height:8px;background:#eef2f7;border-radius:999px;margin-top:12px;overflow:hidden">
                <div style="height:100%;background:${s.color};width:${w}%;border-radius:999px"></div>
              </div>
            </div>
            ${s !== steps[steps.length - 1] ? `<div style="color:var(--text-muted);font-size:24px;padding:0 4px;align-self:center">→</div>` : ''}
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ─────────────── ANDAMENTO (grafico mensile) ───────────────
function renderAndamento(coaches) {
  // Prendo tutti i check-up con venduto=true degli ultimi 12 mesi
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
  const series = coaches.map((c, i) => {
    const vs = venditeDaCheckup(c);
    const byMonth = {};
    vs.forEach(v => {
      if (!v.dataVendita) return;
      const mk = v.dataVendita.substring(0, 7);
      byMonth[mk] = (byMonth[mk] || 0) + v.importo;
    });
    return {
      coach: c,
      color: colors[i % colors.length],
      values: months.map(m => byMonth[m.key] || 0)
    };
  });
  const maxV = Math.max(1, ...series.flatMap(s => s.values));
  const W = 800, H = 220, PAD_L = 50, PAD_R = 20, PAD_T = 20, PAD_B = 40;
  const CW = W - PAD_L - PAD_R;
  const CH = H - PAD_T - PAD_B;
  const stepX = CW / (months.length - 1);
  const pathFor = vals => vals.map((v, i) => {
    const x = PAD_L + i * stepX;
    const y = PAD_T + CH - (v / maxV) * CH;
    return (i === 0 ? 'M' : 'L') + x + ',' + y;
  }).join(' ');
  return `
    <div class="prodotti-card">
      <div style="display:flex;justify-content:flex-end;gap:16px;margin-bottom:12px">
        ${series.map(s => `<span style="font-size:12px;color:var(--text-muted)"><span style="display:inline-block;width:12px;height:2px;background:${s.color};vertical-align:middle;margin-right:6px"></span>${s.coach}</span>`).join('')}
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
        ${[0,0.25,0.5,0.75,1].map(f => {
          const y = PAD_T + CH * (1 - f);
          const val = Math.round(maxV * f);
          return `<line x1="${PAD_L}" y1="${y}" x2="${W-PAD_R}" y2="${y}" stroke="#eef2f7" stroke-width="1"/>
                  <text x="${PAD_L - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${new Intl.NumberFormat('it-IT').format(val)}</text>`;
        }).join('')}
        ${months.map((m, i) => {
          const x = PAD_L + i * stepX;
          return `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#94a3b8">${m.label}</text>`;
        }).join('')}
        ${series.map(s => `
          <path d="${pathFor(s.values)}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${s.values.map((v, i) => {
            const x = PAD_L + i * stepX;
            const y = PAD_T + CH - (v / maxV) * CH;
            return `<circle cx="${x}" cy="${y}" r="3" fill="${s.color}"/>`;
          }).join('')}
        `).join('')}
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

      ${renderNonChiusiCard(coach)}
      ${renderAccontiCard(coach)}
      ${renderVelocitaCard(coach)}
      ${renderChiParlaCard(coach)}
      ${renderVotoCard(coach)}

      <button class="btn-analizza" onclick="state.activeTab='coach:${coach}';render()">Analizza ${coach}</button>
    </div>
  `;
}

// Non chiusi = check-up con VENDUTO=false MA il check-up è stato FATTO
// Motivi (Giardino/Bocciati/Prezzo/Genitori) sono placeholder finché non aggiungiamo le colonne
function renderNonChiusiCard(coach) {
  const cu = state.data.checkup.filter(c => (!coach || c.coach === coach) && String(c.checkupStato).toUpperCase() === 'FATTO' && !c.venduto);
  const total = cu.length;
  // Placeholder distribuzione motivi (da collegare quando avrai colonne nel foglio)
  const motivi = [
    { label: 'Giardino',       count: 0 },
    { label: 'Non rispondono', count: 0 },
    { label: 'Bocciati',       count: 0 },
    { label: 'Prezzo',         count: 0 },
    { label: 'Genitori',       count: 0 }
  ];
  return `
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">
        Non chiusi · ${total}
      </div>
      <div style="height:10px;background:linear-gradient(90deg,#f87171,#ef4444,#dc2626);border-radius:999px;margin-bottom:10px"></div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--text-muted)">
        ${motivi.map(m => `<span><span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;margin-right:5px;vertical-align:middle"></span>${m.label} <b style="color:var(--text)">${m.count}</b></span>`).join('')}
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
  return funnels.map(fn => {
    const [from, to] = computePeriodRange();
    const allVend = venditeDaCheckup(null);
    const vs = allVend.filter(v => v.funnel === fn && inRange(v.dataVendita, from, to));
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
  const allVend = venditeDaCheckup(null);
  const vs = allVend.filter(v => inRange(v.dataVendita, from, to));
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
  const vendite = venditeDaCheckup(coach)
    .filter(v => inRange(v.dataVendita, agg.from, agg.to))
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
