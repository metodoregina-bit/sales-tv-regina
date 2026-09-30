# Sales TV — Metodo Regina

Cruscotto team vendita per Metodo Regina. Dati letti in tempo reale dal Google Sheet **Sales TV Metodo Regina**.

## Stack

- **Frontend**: HTML/CSS/JS puro (no build)
- **Backend**: Express.js — legge Google Sheets via endpoint pubblico `gviz`
- **Auth**: login email/password (session cookie)
- **Deploy**: Railway

## Prerequisito Google Sheet

Il foglio [Sales TV Metodo Regina](https://docs.google.com/spreadsheets/d/1rMgXtcmbr-B5byLr9ZC3o54W2BUm8v8My8ZVEsrzTgg/edit) deve essere impostato **"Chiunque con il link → Visualizzatore"**.

L'URL non è mai esposto agli utenti pubblici — è solo un metodo tecnico per leggerne il contenuto. Il login sull'app garantisce che solo Sofia (e chi ha le credenziali) veda i dati.

## Variabili d'ambiente

| Var | Default | Descrizione |
|---|---|---|
| `PORT` | `3000` | Porta HTTP |
| `SHEET_ID` | `1rMgX...tzTgg` | ID Google Sheet |
| `AUTH_USERS` | `sofia@metodo:regina2026` | Credenziali (formato `email:pwd,email:pwd`) |
| `SESSION_SECRET` | auto-generato | Secret sessione |
| `TAB_VENDITE` | `💅Vendite Regina` | Nome tab vendite |
| `TAB_QC` | `💅Check-up QC prenotati` | Nome tab check-up QC |
| `TAB_QUIZ` | `Check-up Quiz prenotati` | |
| `TAB_SALES` | `Check-up Sales prenotati` | |
| `TAB_ASSISTENZA` | `Check-up Assistenza prenotati` | |
| `TAB_MANUALE` | `Check-up Manuale prenotati` | |

## Sviluppo locale

```bash
npm install
npm start
```

Apri http://localhost:3000 e loggati con `sofia@metodo` / `regina2026`.

## Deploy Railway

1. `git init && git add . && git commit -m "init"`
2. Crea repo GitHub, `git push`
3. Su Railway: **New Project → Deploy from GitHub Repo**
4. Aggiungi variabili d'ambiente (almeno `AUTH_USERS` con la password reale)
5. **Settings → Networking → Generate Domain**

## Struttura

```
public/
  index.html    Layout dashboard + form login
  style.css     Tema chiaro/scuro, KPI cards colorate
  app.js        Fetch API, aggregazione KPI, filtri periodo, viste
server.js       Express + auth + fetch Google Sheets via gviz
```

## KPI mostrati

- **Prospect** — check-up prenotati nel periodo
- **Chiamati** — check-up con SETTING=TRUE
- **Check-up effettuati** — check-up con CHECK UP=FATTO
- **Vendite** — righe in Vendite Regina nel periodo
- **Fatturato per cassa** — importo incassato (col L Data incasso)
- **Fatturato per competenza** — importo venduto (col A Data vendita)
- **Fatturato mese precedente** — prospect mese scorso venduti nel periodo corrente
- **% Check-up** — Check-up fatti / Prospect
- **% Conversione** — Vendite / Check-up fatti
- Breakdown per **Coach** e per **Funnel** (QC / Quiz / Sales / Assistenza / Manuale)
