/**
 * Apps Script per aggiornare il periodo DA/A su tutti i fogli Sales TV
 * del file "Sales TV Metodo Regina".
 *
 * SETUP:
 * 1. Apri il foglio Sales TV Metodo Regina su Google Drive
 * 2. Estensioni → Apps Script
 * 3. Incolla questo codice in un file nuovo (es. set-period.gs)
 * 4. Salva
 * 5. Deploy → Nuovo deployment → Tipo: Web app
 *    - Descrizione: "Set period Sales TV"
 *    - Esegui come: Me (sofia0francesco@gmail.com)
 *    - Chi ha accesso: Chiunque
 * 6. Clicca Deploy, autorizza, e COPIA l'URL del web app
 * 7. Metti l'URL nelle env di Railway come `SHEETS_WRITE_URL`
 *
 * BODY POST atteso: { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "sheetId": "..." (opz) }
 */

var SHEET_ID_DEFAULT = '1rMgXtcmbr-B5byLr9ZC3o54W2BUm8v8My8ZVEsrzTgg';

// Fogli Sales TV da aggiornare (DA in C2, A in C3)
var TARGET_SHEETS = [
  'Sales TV TOTALE',
  'Sales TV Queen Challenge',
  'Sales TV Quiz',
  'Sales TV Sales',
  'Sales TV Assistenza',
  'Sales TV Manuale'
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var from = body.from; // YYYY-MM-DD
    var to = body.to;
    var sheetId = body.sheetId || SHEET_ID_DEFAULT;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return _json({ ok: false, error: 'Date non valide (YYYY-MM-DD)' });
    }

    var dFrom = _parseIsoDate(from);
    var dTo = _parseIsoDate(to);

    var ss = SpreadsheetApp.openById(sheetId);
    var updated = [];
    var missing = [];

    TARGET_SHEETS.forEach(function(name) {
      var sh = ss.getSheetByName(name);
      if (!sh) { missing.push(name); return; }
      sh.getRange('C2').setValue(dFrom);
      sh.getRange('C3').setValue(dTo);
      updated.push(name);
    });

    // Forza ricalcolo di tutte le formule
    SpreadsheetApp.flush();

    return _json({ ok: true, from: from, to: to, updated: updated, missing: missing });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  // Smoke test
  return _json({ ok: true, note: 'Usa POST con {from, to}' });
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _parseIsoDate(iso) {
  var p = iso.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}
