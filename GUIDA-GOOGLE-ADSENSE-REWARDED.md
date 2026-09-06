# Guida: attivare Google AdSense Rewarded Ads su Valuta Facile

> Da fare **dopo** il deploy del sito su `valutafacile.it` (serve un sito live, raggiungibile via HTTPS, per la verifica di Google).

## Perché Rewarded e non Display

Il flusso voluto è: l'utente clicca "Visualizza valore immobile" → guarda un video pubblicitario **fino alla fine** → solo a quel punto si sblocca il report. Questo tipo di "gate" è consentito da Google **solo** tramite il formato ufficiale **Rewarded Ads** — le unità Display normali non possono mai essere usate per bloccare l'accesso a un contenuto, pena la sospensione dell'account.

## Prerequisiti da verificare prima di iniziare

- [ ] Il sito è online su `https://valutafacile.it` con certificato SSL attivo
- [ ] Sono presenti le pagine Privacy Policy, Termini e Contatti (già presenti nel progetto)
- [ ] Hai un'email Google da usare per l'account AdSense (puoi usare `valutafacileitalia@gmail.com`, la stessa già collegata a Brevo)

## Passo 1 — Creare l'account AdSense

1. Vai su **https://www.google.com/adsense** e clicca **Inizia ora**
2. Accedi con l'account Google scelto
3. Inserisci l'URL del sito: `https://valutafacile.it`
4. Seleziona il tuo Paese/territorio di residenza fiscale
5. Inserisci i dati di fatturazione/pagamento (indirizzo, dati fiscali — necessari anche solo per la fase di revisione)
6. Accetta i Termini di servizio AdSense

## Passo 2 — Verifica proprietà del sito

Google ti darà uno snippet tipo:
```html
<meta name="google-adsense-account" content="ca-pub-XXXXXXXXXXXXXXXX">
```
oppure un tag `<script>` da inserire nell'`<head>` del sito. **Mandamelo appena lo hai**: lo aggiungo io nel codice (probabilmente in `index.html`) e lo rideployiamo.

## Passo 3 — Attesa revisione

Google controlla che il sito rispetti le [Program policies](https://support.google.com/adsense/answer/48182). Ci vogliono da pochi giorni a circa 2 settimane. Non serve fare nulla in questa fase, solo aspettare l'email di conferma.

## Passo 4 — Verificare se "Rewarded" è disponibile

Una volta approvato l'account:

1. Vai su **Annunci** (menu laterale) → **Per sito** → seleziona `valutafacile.it`
2. Cerca la tab/sezione **Rewarded** (accanto a "Panoramica", "Display", ecc.)
3. **Se la vedi**: procedi al Passo 5.
4. **Se non la vedi**: significa che il tuo account non è ancora abilitato per questo formato — può dipendere da traffico, tempo dall'approvazione, o disponibilità per la tua categoria di sito. In questo caso fammelo sapere: valutiamo se aspettare o usare temporaneamente il flusso "ad visibile ma non obbligatoria" (Display) come soluzione ponte.

## Passo 5 — Creare l'unità Rewarded

1. Nella tab **Rewarded**, clicca **Crea nuova unità annuncio**
2. Nome: es. `Sblocco Report Valutazione`
3. Tipo ricompensa: **Video completato**
4. Salva

Ti verranno mostrati due valori — mandameli entrambi:

- **Publisher ID**: formato `ca-pub-XXXXXXXXXXXXXXXX` (uguale per tutto il sito, lo trovi anche in Account → Informazioni account)
- **Ad Unit ID**: formato numerico, specifico per questa unità Rewarded

## Passo 6 — Cosa faccio io con questi dati

Il progetto ha già un componente predisposto (`src/components/report/ReportUnlockModal.tsx`, vedi `SETUP-GUIDE.md` Fase 5) con i placeholder `VITE_ADSENSE_PUBLISHER_ID` e `VITE_ADSENSE_AD_UNIT`. Appena mi mandi i due ID:

1. Li inserisco in `.env` / `.env.prod`
2. Verifico/aggiorno il componente per rispettare i requisiti obbligatori di Google per i Rewarded Ads:
   - Schermata di scelta **prima** del video, con opzione chiara "No grazie" (l'utente non può essere costretto a partire in automatico)
   - Tempo sufficiente per decidere se guardare o rifiutare
   - Sblocco del report **solo** al segnale `rewardedSlotGranted` (video completato davvero, non solo aperto)
3. Testiamo insieme il flusso prima di considerarlo definitivo

## Nota importante

**Non cliccare mai i tuoi stessi annunci** durante i test, nemmeno per sbaglio — Google lo rileva come traffico non valido e può sospendere l'account. Se devi testare l'interfaccia, guarda il video di prova fino alla fine ma non interagire oltre a quello richiesto dal flusso.
