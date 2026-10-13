/**
 * Import da file "Tracciamento Check-Up" al Sales TV.
 *
 * Due funzioni:
 *   1) importaTracciamentoCheckupQC()
 *      → Compila le righe di "💅Check-up QC prenotati" matchando per EMAIL.
 *        Scrive SETTING, DATA CHECK-UP (parse anche date testo it), CHECK UP,
 *        RIFISSATO, VENDUTO, NON VENDUTO, PRODOTTO PROPOSTO, PRODOTTO VENDUTO,
 *        IMPORTO e NOTE. Solo celle vuote (non sovrascrive).
 *
 *   2) riportaVenditeInVenditeRegina()
 *      → Legge "💅Check-up QC prenotati", per ogni riga con VENDUTO=true appende
 *        una riga in "💅 Vendite Regina" se non già presente (match su email+importo).
 *        Riporta data vendita = DATA CHECK-UP, data incasso = DATA CHECK-UP,
 *        data prospect = Data compilazione typeform, note dal check-up.
 *        Lascia Acconto/Saldo vuoti (li compila Sofia manualmente).
 *
 * USO: apri editor Apps Script del Sales TV, copia-incolla, Salva, esegui.
 */

const TRACCIAMENTO_SHEET_ID = '1zxE2klJOR5efEGT8WR66zJzRYzwHAhOCM2aYsN02r_4';
const TRACCIAMENTO_TAB = 'Check-Up';
const SALES_TV_SHEET_ID = '1rMgXtcmbr-B5byLr9ZC3o54W2BUm8v8My8ZVEsrzTgg';

// Tracciamento Check-Up (0-indexed)
const TRAC_COL = {
  dataFrontEnd: 0, formCheckUp: 1, eta: 2, nomeCognome: 3, telefono: 4, email: 5,
  provenienza: 6, situazione: 7, orarioSetting: 8, setting: 9, dataCheckup: 10,
  checkup: 11, rifissato: 12, inAttesaEsito: 13, vinto: 14, perso: 15,
  prodottoProposto: 16, prodottoVenduto: 17, importo: 18, note: 19
};

// Check-up QC prenotati (1-indexed per getRange, dal foglio reale 2026-10)
const QC_COL = {
  dataCompilazione: 1, nome: 2, cognome: 3, telefono: 4, email: 5,
  coach: 18, setting: 19, dataCheckup: 24, checkup: 25, rifissato: 26,
  venduto: 28, nonVenduto: 29, obiezione: 30,
  prodottoProposto: 31, prodottoVenduto: 32, importo: 33, note: 34
};

// Vendite Regina (1-indexed per getRange)
const VR_COL = {
  dataVendita: 1, nome: 2, cognome: 3, email: 4, telefono: 5,
  coach: 6, prodotto: 7, importo: 8, modalita: 9,
  acconto: 10, saldo: 11, dataIncasso: 12, funnel: 13, note: 14, dataProspect: 15
};

// Parsa una data: Date → Date, "dd/mm/yyyy" o "dd/mm/yyyy ore HH:MM" → Date, else null
function parseDataIt(v) {
  if (v instanceof Date) return v;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  // "dd/mm/yyyy" oppure "dd\\mm\\yyyy" o "dd-mm-yyyy", eventualmente seguito da " ore HH:MM" o altro
  const m = s.match(/^(\d{1,2})[\/\\\-\.](\d{1,2})[\/\\\-\.](\d{2,4})/);
  if (!m) return null;
  let d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  // Prova a prendere anche ore/minuti se presenti
  const tm = s.match(/(\d{1,2})[:\.](\d{2})/);
  const hh = tm ? parseInt(tm[1], 10) : 0;
  const mm = tm ? parseInt(tm[2], 10) : 0;
  return new Date(y, mo - 1, d, hh, mm);
}

// ─────────────────────────────────────────────────────────────────────
// 1) MERGE Tracciamento → Check-up QC prenotati
// ─────────────────────────────────────────────────────────────────────

function importaTracciamentoCheckupQC() {
  const salesSs = SpreadsheetApp.openById(SALES_TV_SHEET_ID);
  const qcSheet = salesSs.getSheets().filter(function(s){ return /Check-up QC prenotati/i.test(s.getName()); })[0];
  if (!qcSheet) throw new Error('Tab Check-up QC prenotati non trovato');
  Logger.log('Tab QC: ' + qcSheet.getName());

  const tracSs = SpreadsheetApp.openById(TRACCIAMENTO_SHEET_ID);
  const tracSheet = tracSs.getSheetByName(TRACCIAMENTO_TAB);
  if (!tracSheet) throw new Error('Tab Tracciamento non trovato');

  const tracData = tracSheet.getDataRange().getValues();
  const tracByEmail = {};
  for (var i = 1; i < tracData.length; i++) {
    var email = String(tracData[i][TRAC_COL.email] || '').trim().toLowerCase();
    if (!email) continue;
    tracByEmail[email] = tracData[i];
  }

  const qcData = qcSheet.getDataRange().getValues();
  Logger.log('Trac email: ' + Object.keys(tracByEmail).length + ' | QC rows: ' + qcData.length);

  var matched = 0, written = 0;
  for (var i = 1; i < qcData.length; i++) {
    var email = String(qcData[i][QC_COL.email - 1] || '').trim().toLowerCase();
    if (!email) continue;
    var trac = tracByEmail[email];
    if (!trac) continue;
    matched++;

    var current = qcData[i];
    var updates = [];

    if (!current[QC_COL.setting - 1] && trac[TRAC_COL.setting]) updates.push([QC_COL.setting, true]);
    // Data check-up: Date o testo it
    if (!current[QC_COL.dataCheckup - 1]) {
      var td = parseDataIt(trac[TRAC_COL.dataCheckup]);
      if (td) updates.push([QC_COL.dataCheckup, td]);
    }
    if (!current[QC_COL.checkup - 1] && trac[TRAC_COL.checkup]) {
      var v = String(trac[TRAC_COL.checkup]).trim().toUpperCase();
      if (v === 'FATTO') updates.push([QC_COL.checkup, 'FATTO']);
      else if (v.indexOf('RIFISS') >= 0) updates.push([QC_COL.checkup, 'DA RIFISSARE']);
    }
    if (!current[QC_COL.rifissato - 1] && trac[TRAC_COL.rifissato]) updates.push([QC_COL.rifissato, true]);
    if (!current[QC_COL.venduto - 1] && trac[TRAC_COL.vinto]) updates.push([QC_COL.venduto, true]);
    if (!current[QC_COL.nonVenduto - 1] && trac[TRAC_COL.perso]) updates.push([QC_COL.nonVenduto, true]);
    if (!current[QC_COL.prodottoProposto - 1] && trac[TRAC_COL.prodottoProposto]) updates.push([QC_COL.prodottoProposto, String(trac[TRAC_COL.prodottoProposto]).trim()]);
    if (!current[QC_COL.prodottoVenduto - 1] && trac[TRAC_COL.prodottoVenduto]) updates.push([QC_COL.prodottoVenduto, String(trac[TRAC_COL.prodottoVenduto]).trim()]);
    if (!current[QC_COL.importo - 1] && trac[TRAC_COL.importo]) updates.push([QC_COL.importo, Number(trac[TRAC_COL.importo]) || 0]);
    if (!current[QC_COL.note - 1] && trac[TRAC_COL.note]) updates.push([QC_COL.note, String(trac[TRAC_COL.note])]);

    for (var u = 0; u < updates.length; u++) {
      qcSheet.getRange(i + 1, updates[u][0]).setValue(updates[u][1]);
      written++;
    }
  }

  Logger.log('Match: ' + matched + ' | Scritte: ' + written);
  salesSs.toast('QC: ' + matched + ' match, ' + written + ' celle', 'Tracciamento → Check-up QC', 10);
  return { matched: matched, written: written };
}

// ─────────────────────────────────────────────────────────────────────
// 2) RIPORTA VENDITE: Check-up QC prenotati → Vendite Regina
// ─────────────────────────────────────────────────────────────────────

function riportaVenditeInVenditeRegina() {
  const salesSs = SpreadsheetApp.openById(SALES_TV_SHEET_ID);
  const qcSheet = salesSs.getSheets().filter(function(s){ return /Check-up QC prenotati/i.test(s.getName()); })[0];
  if (!qcSheet) throw new Error('Tab Check-up QC prenotati non trovato');
  const vrSheet = salesSs.getSheets().filter(function(s){ return /Vendite Regina/i.test(s.getName()); })[0];
  if (!vrSheet) throw new Error('Tab Vendite Regina non trovato');
  Logger.log('QC: ' + qcSheet.getName() + ' | VR: ' + vrSheet.getName());

  const qcData = qcSheet.getDataRange().getValues();
  const vrData = vrSheet.getDataRange().getValues();

  // Index Vendite Regina esistenti per (email+importo)
  const vrByKey = {};
  for (var i = 1; i < vrData.length; i++) {
    var em = String(vrData[i][VR_COL.email - 1] || '').trim().toLowerCase();
    var im = Number(vrData[i][VR_COL.importo - 1] || 0);
    if (!em) continue;
    vrByKey[em + '|' + im] = i + 1;
  }

  // Trova la prima riga vuota in Vendite Regina
  // Scorri dal basso tenendo conto che il memory diceva: le righe sono preparate con dropdown.
  // Prendo l'ultima riga non-vuota (con data vendita o nome) + 1.
  var lastDataRow = 1; // header è riga 1
  for (var i = 1; i < vrData.length; i++) {
    if (vrData[i][VR_COL.dataVendita - 1] || vrData[i][VR_COL.nome - 1] || vrData[i][VR_COL.importo - 1]) {
      lastDataRow = i + 1;
    }
  }
  var nextRow = lastDataRow + 1;
  Logger.log('Prima riga libera VR: ' + nextRow);

  var created = 0, skipped = 0, noData = 0;
  for (var i = 1; i < qcData.length; i++) {
    var r = qcData[i];
    var venduto = r[QC_COL.venduto - 1];
    if (!venduto) continue;
    var email = String(r[QC_COL.email - 1] || '').trim().toLowerCase();
    var importo = Number(r[QC_COL.importo - 1] || 0);
    if (!email || !importo) { noData++; continue; }

    if (vrByKey[email + '|' + importo]) {
      skipped++;
      continue;
    }

    // Costruisci la riga Vendite Regina
    var dataCheckup = r[QC_COL.dataCheckup - 1];
    if (!(dataCheckup instanceof Date)) {
      // fallback: Data compilazione typeform
      dataCheckup = r[QC_COL.dataCompilazione - 1];
    }
    var dataProspect = r[QC_COL.dataCompilazione - 1];
    if (dataProspect instanceof Date === false) dataProspect = null;

    var rowValues = new Array(15).fill('');
    rowValues[VR_COL.dataVendita - 1] = dataCheckup || '';
    rowValues[VR_COL.nome - 1] = r[QC_COL.nome - 1] || '';
    rowValues[VR_COL.cognome - 1] = r[QC_COL.cognome - 1] || '';
    rowValues[VR_COL.email - 1] = r[QC_COL.email - 1] || '';
    rowValues[VR_COL.telefono - 1] = r[QC_COL.telefono - 1] || '';
    rowValues[VR_COL.coach - 1] = r[QC_COL.coach - 1] || 'Sofia';
    rowValues[VR_COL.prodotto - 1] = r[QC_COL.prodottoVenduto - 1] || '';
    rowValues[VR_COL.importo - 1] = importo;
    rowValues[VR_COL.modalita - 1] = '';
    rowValues[VR_COL.acconto - 1] = false;
    rowValues[VR_COL.saldo - 1] = false;
    rowValues[VR_COL.dataIncasso - 1] = dataCheckup || '';
    rowValues[VR_COL.funnel - 1] = 'Queen Challenge';
    rowValues[VR_COL.note - 1] = r[QC_COL.note - 1] || '';
    rowValues[VR_COL.dataProspect - 1] = dataProspect || '';

    vrSheet.getRange(nextRow, 1, 1, rowValues.length).setValues([rowValues]);
    vrByKey[email + '|' + importo] = nextRow;
    nextRow++;
    created++;
  }

  Logger.log('Create: ' + created + ' | Già presenti: ' + skipped + ' | Senza data: ' + noData);
  salesSs.toast('VR: +' + created + ' righe (' + skipped + ' già presenti)', 'Check-up → Vendite Regina', 10);
  return { created: created, skipped: skipped, noData: noData };
}

// ─────────────────────────────────────────────────────────────────────
// Shortcut: esegue entrambi gli step in sequenza
// ─────────────────────────────────────────────────────────────────────

function importaTutto() {
  var r1 = importaTracciamentoCheckupQC();
  var r2 = riportaVenditeInVenditeRegina();
  Logger.log('Totale QC: ' + r1.matched + ' match, ' + r1.written + ' celle · VR: +' + r2.created + ' righe');
  return { qc: r1, vr: r2 };
}
