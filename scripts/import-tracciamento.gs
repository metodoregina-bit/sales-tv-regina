/**
 * Import e manutenzione Sales TV ↔ Tracciamento Check-Up.
 *
 * Funzioni principali:
 *   - importaTracciamentoCheckupQC()       : merge dati per email, scrive solo celle vuote
 *   - syncTracciamentoCheckupQCForzato()   : sync forzato (sovrascrive) → risolve doppi esiti
 *   - riportaVenditeInVenditeRegina()      : copia check-up VENDUTO=TRUE in Vendite Regina (match email+importo)
 *   - importaTutto()                        : esegue le prime due in sequenza
 *   - elencaVenditeSenzaRiscontroQC()      : DRY-RUN lista righe VR senza riscontro VENDUTO in QC
 *   - eliminaRigheSenzaRiscontroVR()       : elimina da VR le righe senza riscontro VENDUTO in QC
 *   - sortVenditeReginaByData()            : ordina VR per Data vendita ASC (vecchie sopra)
 *   - shiftTracciamentoDown()              : inserisce riga vuota in posizione 2 del Tracciamento
 *   - shiftCheckupQC()                     : inserisce riga vuota in posizione 2 del Check-up QC prenotati
 *   - shiftQCDaElisabettaAraujo()          : da riga Araujo in giù shifta colonne SETTING..NOTE di 1 riga
 *
 * USO: apri editor Apps Script del Sales TV, incolla, Salva, esegui.
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

// Check-up QC prenotati (1-indexed per getRange)
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

// Parsa data: Date → Date, "dd/mm/yyyy" o "dd/mm/yyyy ore HH:MM" → Date
function parseDataIt(v) {
  if (v instanceof Date) return v;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\\\-\.](\d{1,2})[\/\\\-\.](\d{2,4})/);
  if (!m) return null;
  let d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  const tm = s.match(/(\d{1,2})[:\.](\d{2})/);
  const hh = tm ? parseInt(tm[1], 10) : 0;
  const mm = tm ? parseInt(tm[2], 10) : 0;
  return new Date(y, mo - 1, d, hh, mm);
}

function findSheet(ss, regex) {
  return ss.getSheets().filter(function(s){ return regex.test(s.getName()); })[0];
}

// ─────────────────────────────────────────────────────────────
// 1) MERGE Tracciamento → Check-up QC (solo celle vuote)
// ─────────────────────────────────────────────────────────────

function importaTracciamentoCheckupQC() {
  const salesSs = SpreadsheetApp.openById(SALES_TV_SHEET_ID);
  const qcSheet = findSheet(salesSs, /Check-up QC prenotati/i);
  if (!qcSheet) throw new Error('Tab Check-up QC prenotati non trovato');
  const tracSs = SpreadsheetApp.openById(TRACCIAMENTO_SHEET_ID);
  const tracSheet = tracSs.getSheetByName(TRACCIAMENTO_TAB);

  const tracData = tracSheet.getDataRange().getValues();
  const tracByEmail = {};
  for (var i = 1; i < tracData.length; i++) {
    var email = String(tracData[i][TRAC_COL.email] || '').trim().toLowerCase();
    if (!email) continue;
    tracByEmail[email] = tracData[i];
  }

  const qcData = qcSheet.getDataRange().getValues();
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
  return { matched: matched, written: written };
}

// ─────────────────────────────────────────────────────────────
// 2) SYNC FORZATO Tracciamento → Check-up QC (sovrascrive)
// Risolve casi "doppio esito" (venduto=T + nonVenduto=T)
// ─────────────────────────────────────────────────────────────

function syncTracciamentoCheckupQCForzato() {
  const salesSs = SpreadsheetApp.openById(SALES_TV_SHEET_ID);
  const qc = findSheet(salesSs, /Check-up QC prenotati/i);
  const trac = SpreadsheetApp.openById(TRACCIAMENTO_SHEET_ID).getSheetByName(TRACCIAMENTO_TAB);

  const tracData = trac.getDataRange().getValues();
  const tracByEmail = {};
  for (var i = 1; i < tracData.length; i++) {
    var em = String(tracData[i][TRAC_COL.email] || '').trim().toLowerCase();
    if (em) tracByEmail[em] = tracData[i];
  }

  const qcData = qc.getDataRange().getValues();
  var matched = 0, written = 0, fixedDouble = 0;
  for (var i = 1; i < qcData.length; i++) {
    var em = String(qcData[i][QC_COL.email - 1] || '').trim().toLowerCase();
    if (!em) continue;
    var t = tracByEmail[em];
    if (!t) continue;
    matched++;
    var row = i + 1;
    var cur = qcData[i];
    var expSetting = !!t[TRAC_COL.setting];
    var tdCheckup = parseDataIt(t[TRAC_COL.dataCheckup]);
    var expCheckup = null;
    if (t[TRAC_COL.checkup]) {
      var v = String(t[TRAC_COL.checkup]).trim().toUpperCase();
      if (v === 'FATTO') expCheckup = 'FATTO';
      else if (v.indexOf('RIFISS') >= 0) expCheckup = 'DA RIFISSARE';
    }
    var expVenduto = !!t[TRAC_COL.vinto];
    var expNonVenduto = !!t[TRAC_COL.perso];
    if (cur[QC_COL.venduto - 1] && cur[QC_COL.nonVenduto - 1]) fixedDouble++;
    function set(col, val) {
      if (cur[col - 1] === val) return;
      qc.getRange(row, col).setValue(val);
      written++;
    }
    set(QC_COL.setting, expSetting);
    if (tdCheckup) set(QC_COL.dataCheckup, tdCheckup);
    if (expCheckup !== null) set(QC_COL.checkup, expCheckup);
    set(QC_COL.rifissato, !!t[TRAC_COL.rifissato]);
    set(QC_COL.venduto, expVenduto);
    set(QC_COL.nonVenduto, expNonVenduto);
    if (t[TRAC_COL.prodottoProposto]) set(QC_COL.prodottoProposto, String(t[TRAC_COL.prodottoProposto]).trim());
    if (t[TRAC_COL.prodottoVenduto]) set(QC_COL.prodottoVenduto, String(t[TRAC_COL.prodottoVenduto]).trim());
    if (t[TRAC_COL.importo]) set(QC_COL.importo, Number(t[TRAC_COL.importo]));
    if (t[TRAC_COL.note]) set(QC_COL.note, String(t[TRAC_COL.note]));
  }
  Logger.log('Match: ' + matched + ' | Scritte: ' + written + ' | Doppi: ' + fixedDouble);
  return { matched: matched, written: written, fixedDouble: fixedDouble };
}

// ─────────────────────────────────────────────────────────────
// 3) Check-up QC → Vendite Regina (append per VENDUTO non già in VR)
// ─────────────────────────────────────────────────────────────

function riportaVenditeInVenditeRegina() {
  const salesSs = SpreadsheetApp.openById(SALES_TV_SHEET_ID);
  const qcSheet = findSheet(salesSs, /Check-up QC prenotati/i);
  const vrSheet = findSheet(salesSs, /Vendite Regina/i);

  const qcData = qcSheet.getDataRange().getValues();
  const vrData = vrSheet.getDataRange().getValues();
  const vrByKey = {};
  for (var i = 1; i < vrData.length; i++) {
    var em = String(vrData[i][VR_COL.email - 1] || '').trim().toLowerCase();
    var im = Number(vrData[i][VR_COL.importo - 1] || 0);
    if (em) vrByKey[em + '|' + im] = i + 1;
  }

  var lastDataRow = 1;
  for (var i = 1; i < vrData.length; i++) {
    if (vrData[i][VR_COL.dataVendita - 1] || vrData[i][VR_COL.nome - 1] || vrData[i][VR_COL.importo - 1]) lastDataRow = i + 1;
  }
  var nextRow = lastDataRow + 1;

  var created = 0, skipped = 0, noData = 0;
  for (var i = 1; i < qcData.length; i++) {
    var r = qcData[i];
    if (!r[QC_COL.venduto - 1]) continue;
    var email = String(r[QC_COL.email - 1] || '').trim().toLowerCase();
    var importo = Number(r[QC_COL.importo - 1] || 0);
    if (!email || !importo) { noData++; continue; }
    if (vrByKey[email + '|' + importo]) { skipped++; continue; }

    var dataCheckup = r[QC_COL.dataCheckup - 1];
    if (!(dataCheckup instanceof Date)) dataCheckup = r[QC_COL.dataCompilazione - 1];
    var dataProspect = r[QC_COL.dataCompilazione - 1];
    if (dataProspect instanceof Date === false) dataProspect = null;

    var row = new Array(15).fill('');
    row[VR_COL.dataVendita - 1] = dataCheckup || '';
    row[VR_COL.nome - 1] = r[QC_COL.nome - 1] || '';
    row[VR_COL.cognome - 1] = r[QC_COL.cognome - 1] || '';
    row[VR_COL.email - 1] = r[QC_COL.email - 1] || '';
    row[VR_COL.telefono - 1] = r[QC_COL.telefono - 1] || '';
    row[VR_COL.coach - 1] = r[QC_COL.coach - 1] || 'Sofia';
    row[VR_COL.prodotto - 1] = r[QC_COL.prodottoVenduto - 1] || '';
    row[VR_COL.importo - 1] = importo;
    row[VR_COL.acconto - 1] = false;
    row[VR_COL.saldo - 1] = false;
    row[VR_COL.dataIncasso - 1] = dataCheckup || '';
    row[VR_COL.funnel - 1] = 'Queen Challenge';
    row[VR_COL.note - 1] = r[QC_COL.note - 1] || '';
    row[VR_COL.dataProspect - 1] = dataProspect || '';
    vrSheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
    vrByKey[email + '|' + importo] = nextRow;
    nextRow++;
    created++;
  }
  Logger.log('Create: ' + created + ' | Gia presenti: ' + skipped + ' | Senza data: ' + noData);
  return { created: created, skipped: skipped, noData: noData };
}

function importaTutto() {
  var r1 = importaTracciamentoCheckupQC();
  var r2 = riportaVenditeInVenditeRegina();
  Logger.log('TOT: QC ' + r1.matched + '/' + r1.written + ' · VR +' + r2.created);
  return { qc: r1, vr: r2 };
}

// ─────────────────────────────────────────────────────────────
// 4) MANUTENZIONE VR
// ─────────────────────────────────────────────────────────────

// DRY-RUN: elenca righe VR che non hanno riscontro VENDUTO=TRUE nel QC
function elencaVenditeSenzaRiscontroQC() {
  const salesSs = SpreadsheetApp.openById(SALES_TV_SHEET_ID);
  const qc = findSheet(salesSs, /Check-up QC prenotati/i);
  const vr = findSheet(salesSs, /Vendite Regina/i);
  const qcData = qc.getDataRange().getValues();
  const vendutiQC = {};
  for (var i = 1; i < qcData.length; i++) {
    var em = String(qcData[i][QC_COL.email - 1] || '').trim().toLowerCase();
    if (em && qcData[i][QC_COL.venduto - 1]) vendutiQC[em] = true;
  }
  const vrData = vr.getDataRange().getValues();
  var daRimuovere = [];
  for (var i = 1; i < vrData.length; i++) {
    var em = String(vrData[i][VR_COL.email - 1] || '').trim().toLowerCase();
    var nome = vrData[i][VR_COL.nome - 1];
    if (!em && !nome) continue;
    if (!vendutiQC[em]) daRimuovere.push({ row: i + 1, nome: nome, cognome: vrData[i][VR_COL.cognome - 1], importo: vrData[i][VR_COL.importo - 1] });
  }
  Logger.log('Righe da rimuovere: ' + daRimuovere.length);
  daRimuovere.forEach(function(r){ Logger.log(' - riga ' + r.row + ' ' + r.nome + ' ' + r.cognome + ' ' + r.importo); });
  return daRimuovere;
}

function eliminaRigheSenzaRiscontroVR() {
  const salesSs = SpreadsheetApp.openById(SALES_TV_SHEET_ID);
  const qc = findSheet(salesSs, /Check-up QC prenotati/i);
  const vr = findSheet(salesSs, /Vendite Regina/i);
  const qcData = qc.getDataRange().getValues();
  const vendutiQC = {};
  for (var i = 1; i < qcData.length; i++) {
    var em = String(qcData[i][QC_COL.email - 1] || '').trim().toLowerCase();
    if (em && qcData[i][QC_COL.venduto - 1]) vendutiQC[em] = true;
  }
  const vrData = vr.getDataRange().getValues();
  var righe = [];
  for (var i = 1; i < vrData.length; i++) {
    var em = String(vrData[i][VR_COL.email - 1] || '').trim().toLowerCase();
    if (!em && !vrData[i][VR_COL.nome - 1]) continue;
    if (!vendutiQC[em]) righe.push(i + 1);
  }
  righe.sort(function(a,b){ return b - a; });
  for (var k = 0; k < righe.length; k++) vr.deleteRow(righe[k]);
  Logger.log('Rimosse ' + righe.length + ' righe');
  return righe.length;
}

function sortVenditeReginaByData() {
  const vr = findSheet(SpreadsheetApp.openById(SALES_TV_SHEET_ID), /Vendite Regina/i);
  const last = vr.getLastRow();
  if (last < 3) return;
  vr.getRange(2, 1, last - 1, vr.getLastColumn()).sort({ column: 1, ascending: true });
  Logger.log('Ordinato per Data vendita ASC');
}

// ─────────────────────────────────────────────────────────────
// 5) SHIFT UTILITIES
// ─────────────────────────────────────────────────────────────

function shiftTracciamentoDown() {
  const trac = SpreadsheetApp.openById(TRACCIAMENTO_SHEET_ID).getSheetByName(TRACCIAMENTO_TAB);
  trac.insertRowBefore(2);
  Logger.log('Inserita riga 2 in Tracciamento');
}

function shiftCheckupQC() {
  const qc = findSheet(SpreadsheetApp.openById(SALES_TV_SHEET_ID), /Check-up QC prenotati/i);
  qc.insertRowBefore(2);
  Logger.log('Inserita riga 2 in Check-up QC');
}

// Shift SETTING..NOTE (col 19..34) di 1 riga in giù, da riga di Elisabetta Araujo
function shiftQCDaElisabettaAraujo() {
  const qc = findSheet(SpreadsheetApp.openById(SALES_TV_SHEET_ID), /Check-up QC prenotati/i);
  const data = qc.getDataRange().getValues();
  var startRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim().toLowerCase() === 'elisabetta' &&
        String(data[i][2] || '').trim().toLowerCase() === 'araujo') { startRow = i + 1; break; }
  }
  if (startRow < 0) throw new Error('Elisabetta Araujo non trovata');
  const lastRow = qc.getLastRow();
  const nRows = lastRow - startRow + 1;
  const firstCol = 19, numCols = 16;
  const block = qc.getRange(startRow, firstCol, nRows, numCols).getValues();
  qc.getRange(startRow + 1, firstCol, nRows, numCols).setValues(block);
  qc.getRange(startRow, firstCol, 1, numCols).clearContent();
  Logger.log('Shiftato ' + nRows + ' righe x ' + numCols + ' colonne');
}
