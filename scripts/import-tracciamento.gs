/**
 * Importa i check-up vecchi dal file "Tracciamento Check-Up" al foglio
 * "💅Check-up QC prenotati" del Sales TV. Fa match per EMAIL e scrive solo
 * le colonne di tracking post-call (SETTING, DATA CHECK-UP, CHECK UP,
 * RIFISSATO, VENDUTO, NON VENDUTO, PRODOTTO PROPOSTO, PRODOTTO VENDUTO, IMPORTO).
 *
 * NON crea righe nuove — scrive solo su righe già presenti in Check-up QC
 * (quelle venute dal Typeform).
 *
 * NON triggera onEdit perché le API batch non attivano i simple trigger.
 * I check-up VINTO vanno riportati manualmente in Vendite Regina o tramite
 * un secondo script (sono gestiti separatamente, vedi memory).
 *
 * USO:
 * 1. Apri editor Apps Script del Sales TV (Estensioni → Apps Script sul foglio Sales TV)
 * 2. Crea nuovo file, incolla questo codice, Salva
 * 3. Esegui `importaTracciamentoCheckupQC`
 * 4. Guarda i log (Visualizza → Log) per riepilogo match/scritture
 */

const TRACCIAMENTO_SHEET_ID = '1zxE2klJOR5efEGT8WR66zJzRYzwHAhOCM2aYsN02r_4';
const TRACCIAMENTO_TAB = 'Check-Up';
const SALES_TV_SHEET_ID = '1rMgXtcmbr-B5byLr9ZC3o54W2BUm8v8My8ZVEsrzTgg';

// Colonne nel foglio Tracciamento Check-Up (0-indexed)
const TRAC_COL = {
  dataFrontEnd: 0,
  formCheckUp: 1,
  eta: 2,
  nomeCognome: 3,
  telefono: 4,
  email: 5,
  provenienza: 6,
  situazione: 7,
  orarioSetting: 8,
  setting: 9,
  dataCheckup: 10,
  checkup: 11,
  rifissato: 12,
  inAttesaEsito: 13,
  vinto: 14,
  perso: 15,
  prodottoProposto: 16,
  prodottoVenduto: 17,
  importo: 18,
  note: 19
};

// Colonne nel foglio Check-up QC prenotati (1-indexed per getRange)
const QC_COL = {
  email: 5,
  setting: 19,
  dataCheckup: 24,
  checkup: 25,
  rifissato: 26,
  venduto: 28,
  nonVenduto: 29,
  obiezione: 30,
  prodottoProposto: 31,
  prodottoVenduto: 32,
  importo: 33
};

function importaTracciamentoCheckupQC() {
  const salesSs = SpreadsheetApp.openById(SALES_TV_SHEET_ID);
  // Il tab può avere emoji con o senza spazio — cerco via regex
  const qcSheet = salesSs.getSheets().filter(function(s){ return /Check-up QC prenotati/i.test(s.getName()); })[0];
  if (!qcSheet) throw new Error('Tab Check-up QC prenotati non trovato');
  Logger.log('Tab QC trovato: ' + qcSheet.getName());

  const tracSs = SpreadsheetApp.openById(TRACCIAMENTO_SHEET_ID);
  const tracSheet = tracSs.getSheetByName(TRACCIAMENTO_TAB);
  if (!tracSheet) throw new Error('Tab "' + TRACCIAMENTO_TAB + '" non trovato in Tracciamento');

  const tracData = tracSheet.getDataRange().getValues();
  // Trac row 0 = header
  const tracByEmail = {};
  for (let i = 1; i < tracData.length; i++) {
    const row = tracData[i];
    const email = String(row[TRAC_COL.email] || '').trim().toLowerCase();
    if (!email) continue;
    tracByEmail[email] = row;
  }

  const qcData = qcSheet.getDataRange().getValues();
  const nRows = qcData.length;
  Logger.log('Tracciamento righe con email: ' + Object.keys(tracByEmail).length);
  Logger.log('Check-up QC righe totali: ' + nRows);

  let matched = 0, written = 0;
  const matches = [];
  for (let i = 1; i < nRows; i++) {
    const email = String(qcData[i][QC_COL.email - 1] || '').trim().toLowerCase();
    if (!email) continue;
    const trac = tracByEmail[email];
    if (!trac) continue;
    matched++;
    matches.push({ qcRow: i + 1, email, nome: trac[TRAC_COL.nomeCognome] });

    // Scrive solo se la cella Check-up QC è VUOTA, altrimenti lascia stare
    // (evita di sovrascrivere dati già inseriti da Sofia).
    const current = qcData[i];
    const updates = [];

    // SETTING (col 19)
    if (!current[QC_COL.setting - 1] && trac[TRAC_COL.setting]) {
      updates.push([QC_COL.setting, true]);
    }
    // DATA CHECK-UP (col 24): solo se è una data (ignora testo tipo "NON SAPUTA GESTIRE")
    const td = trac[TRAC_COL.dataCheckup];
    if (!current[QC_COL.dataCheckup - 1] && td instanceof Date) {
      updates.push([QC_COL.dataCheckup, td]);
    }
    // CHECK UP (col 25)
    if (!current[QC_COL.checkup - 1] && trac[TRAC_COL.checkup]) {
      const v = String(trac[TRAC_COL.checkup]).trim().toUpperCase();
      if (v === 'FATTO') updates.push([QC_COL.checkup, 'FATTO']);
      else if (v.indexOf('RIFISS') >= 0) updates.push([QC_COL.checkup, 'DA RIFISSARE']);
    }
    // RIFISSATO (col 26)
    if (!current[QC_COL.rifissato - 1] && trac[TRAC_COL.rifissato]) {
      updates.push([QC_COL.rifissato, true]);
    }
    // VENDUTO (col 28)
    if (!current[QC_COL.venduto - 1] && trac[TRAC_COL.vinto]) {
      updates.push([QC_COL.venduto, true]);
    }
    // NON VENDUTO (col 29)
    if (!current[QC_COL.nonVenduto - 1] && trac[TRAC_COL.perso]) {
      updates.push([QC_COL.nonVenduto, true]);
    }
    // PRODOTTO PROPOSTO (col 31)
    if (!current[QC_COL.prodottoProposto - 1] && trac[TRAC_COL.prodottoProposto]) {
      updates.push([QC_COL.prodottoProposto, String(trac[TRAC_COL.prodottoProposto]).trim()]);
    }
    // PRODOTTO VENDUTO (col 32)
    if (!current[QC_COL.prodottoVenduto - 1] && trac[TRAC_COL.prodottoVenduto]) {
      updates.push([QC_COL.prodottoVenduto, String(trac[TRAC_COL.prodottoVenduto]).trim()]);
    }
    // IMPORTO (col 33)
    if (!current[QC_COL.importo - 1] && trac[TRAC_COL.importo]) {
      updates.push([QC_COL.importo, Number(trac[TRAC_COL.importo]) || 0]);
    }

    for (const [col, val] of updates) {
      qcSheet.getRange(i + 1, col).setValue(val);
      written++;
    }
  }

  Logger.log('Match trovati: ' + matched);
  Logger.log('Celle scritte: ' + written);
  Logger.log('Dettaglio match:');
  matches.forEach(m => Logger.log(' - riga ' + m.qcRow + ' ' + m.nome + ' <' + m.email + '>'));

  salesSs.toast('Import completato: ' + matched + ' match, ' + written + ' celle scritte.', 'Tracciamento → Check-up QC', 10);
  return { matched: matched, written: written, matches: matches };
}
