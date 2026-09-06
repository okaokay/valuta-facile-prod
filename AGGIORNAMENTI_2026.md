# Documento di Compliance e Privacy  
_Sistema di Valutazione Immobiliare Online_

> Versione: 1.0  
> Data ultimo aggiornamento: 22/02/2026  
> Responsabile aggiornamento documento: [DA COMPILARE – es. Titolare o Referente Privacy]

---

## 1. Scopo del documento

Questo documento descrive in modo operativo:

- come funziona l’applicazione di valutazione immobiliare dal punto di vista tecnico e dei dati;
- quali categorie di dati personali vengono trattate;
- per quali finalità e su quali basi giuridiche (GDPR);
- come sono gestiti consensi, diritti degli interessati, conservazione e sicurezza;
- come è strutturato il “registro dei trattamenti” (operativo e formale);
- testi da utilizzare come informativa agli utenti.

È pensato per:

- supportare l’operatività quotidiana (sviluppo, staff, marketing);
- fornire una base per eventuali controlli da parte del Garante o audit interni.

---

## 2. Panoramica dell’applicazione

### 2.1. Architettura tecnica

- **Frontend**
  - Framework: React
  - Funzioni principali:
    - Raccolta indirizzo e dati immobile (wizard multi-step)
    - Chiamate a servizi di autocompletamento indirizzi (Nominatim, Photon)
    - Visualizzazione della valutazione (prezzo min/medio/max, €/mq)
    - Popup form contatti per sbloccare la valutazione
    - Dashboard admin (“Valutatore Staff”):
      - elenco contatti/leads
      - mappa comuni italiani e raggruppamenti
      - registro trattamenti (vista interna)

- **Backend**
  - Ambiente: Node.js + Express
  - Funzioni principali:
    - Endpoint di valutazione “enhanced-omi” (integrazione OMI + logica interna)
    - Endpoint per salvataggio lead (contatto, indirizzo, immobile, valutazione, wizard)
    - Autenticazione admin (login + token, eventuale 2FA)
    - Esposizione dati per dashboard admin

- **Database e storage**
  - Database: SQLite (file locale) per leads e dati strutturati.
  - Storage file: planimetrie e fotografie caricate dagli utenti.

- **Servizi esterni**
  - Geocoding:
    - Nominatim (OpenStreetMap)
    - Photon (Komoot)
  - Intelligenza artificiale per la valutazione:
    - Groq AI (API modelli tipo llama)
  - Dati OMI:
    - dataset OMI interno (CAP → fascia di prezzo/area)

### 2.2. Flusso dati ad alto livello

1. Utente inserisce indirizzo → frontend chiama servizi di geocoding → viene selezionato un indirizzo con coordinate e CAP.
2. Il frontend chiama il backend per recuperare i dati OMI basati sul CAP.
3. L’utente compila i dati dell’immobile (superficie, stato, piano, extra, ecc.).
4. Il backend calcola una valutazione (logica interna + dati OMI) e, se configurato, integra un’analisi AI tramite Groq.
5. La valutazione viene mostrata nel frontend; il popup contatti chiede dati personali e consenso privacy.
6. Se l’utente compila il form:
   - il frontend invia un “lead” al backend (contact + address + property + valuation + wizardData + eventuali media).
   - il lead viene memorizzato nel DB e reso visibile in dashboard admin.
7. Staff/admin utilizza la dashboard per:
   - vedere/elaborare contatti;
   - raggruppare per comune/CAP;
   - consultare il registro trattamenti operativo.

---

## 3. Dati trattati

### 3.1. Dati anagrafici e di contatto

- Nome, cognome
- Indirizzo e-mail
- Numero di telefono

### 3.2. Dati immobile

- Indirizzo completo (via, numero civico, CAP, comune, provincia, regione)
- Coordinate (lat, lon) approssimative
- Caratteristiche principali:
  - Superficie (mq)
  - Numero locali, bagni
  - Piano, presenza ascensore
  - Stato immobile (Nuovo, Buono, Da ristrutturare)
  - Anno di costruzione (se fornito)
- Spazi aggiuntivi:
  - balconi, terrazzi, veranda
  - mansarda, soffitta, taverna
  - giardino, rooftop, garage

### 3.3. Dati di percorso/wizard (lead)

- Profilo utente: PRIVATO / altro
- È proprietario o meno
- Tempistiche di vendita
- Richiesta di valutazioni da agenzie esperte di zona
- Consenso marketing (boolean)
- Informazioni di esposizione/POI, media caricati (planimetrie/foto) e analisi AI associata

### 3.4. Dati tecnici

- Log accessi area admin (timestamp, endpoint, esiti)
- Eventuali log di errore backend
- Token di sessione per area admin (in sessionStorage)

---

## 4. Finalità e basi giuridiche (riassunto operativo)

| Finalità                                 | Descrizione breve                                                                                     | Base giuridica principale                                                   |
|-----------------------------------------|--------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| Valutazione immobiliare online          | Calcolo valore immobile (OMI + AI) sulla base di indirizzo e caratteristiche immobile                 | Art. 6.1.b GDPR: misure precontrattuali su richiesta dell’interessato      |
| Gestione contatti e lead                | Salvataggio contatto, ricontatto dell’utente, gestione in dashboard                                   | Art. 6.1.b GDPR + Art. 6.1.f (organizzazione commerciale)                  |
| Analisi interne e dashboard staff       | Statistiche interne, raggruppamenti per CAP/comune, miglioramento servizio                            | Art. 6.1.f GDPR (legittimo interesse)                                       |
| Marketing diretto e agenzie di zona     | Invio comunicazioni promozionali, condivisione con agenzie partner previa scelta/consenso utente      | Art. 6.1.a GDPR (consenso) + art. 130 Codice Privacy                        |
| Sicurezza, log tecnici, difesa in giudizio | Log accessi admin, prevenzione abusi, risposta ad incidenti, difesa in caso di contenziosi           | Art. 6.1.f GDPR (sicurezza/legittimo interesse) + art. 6.1.c (obblighi legge)|

---

## 5. Registro dei trattamenti

### 5.1. Registro operativo (in-app)

Il registro operativo è visibile nella dashboard admin:

- Menu “Registro trattamenti”
- Mostra una tabella con:
  - finalità → categorie dati → interessati → base giuridica → conservazione indicativa

Questo registro serve a:

- dare allo staff una visione chiara di **cosa** viene trattato e **perché**;
- tenere allineata la pratica quotidiana con la documentazione formale.

### 5.2. Registro formale (art. 30 GDPR)

Il registro formale dei trattamenti deve contenere anche:

- denominazione e recapiti del titolare;
- eventuali contitolari;
- eventuali responsabili del trattamento;
- eventuale DPO;
- destinatari/fornitori (Groq, hosting, mail provider, ecc.);
- trasferimenti in Paesi terzi e garanzie (SCC, ecc.);
- descrizione dettagliata delle misure di sicurezza.

**Posizione consigliata del registro formale:**

- File: `Registro_Trattamenti_Titolare.pdf`  
- Posizione: `[DA COMPILARE – es. cartella condivisa aziendale /Compliance/Registro_Trattamenti/]`
- Copia di backup: `[DA COMPILARE – es. archivio legale, share criptato, ecc.]`

Il testo in dashboard richiama esplicitamente l’esistenza di questo registro formale.

---

## 6. Consensi e gestione privacy nel frontend

### 6.1. Banner informativo

- Banner fisso in basso, fino ad “Accetto”.
- Testo: indica che i dati sono usati per valutazione e contatto.
- Link “privacy policy” apre il modale con l’informativa completa.
- Stato “accettato” salvato in `localStorage` (`valutatore_privacy_banner_v1 = 'accepted'`).

### 6.2. Form contatti

Nel popup `ContactForm`:

- Campi obbligatori: nome, cognome, email, telefono, checkbox privacy.
- Testo vicino alla checkbox:

  > Accetto la privacy policy e il trattamento dei miei dati personali *

- Il link “privacy policy” apre lo stesso modale privacy del footer/banner.
- Validazione client-side: il form non parte senza privacy accettata.

### 6.3. Salvataggio consensi lato backend

Nel lead salvato:

- `contact`: dati anagrafici
- `wizardData.lead.marketingConsent`: true/false
- `wizardData.lead.wantAgenciesValuation`: true/false
- `privacyAccepted`: è implicito (dato che il form blocca senza checkbox; si può comunque aggiungere un campo booleano nel JSON se si vuole un tracciamento esplicito).

Per un controllo:

- si può filtrare sull’email/telefono in dashboard,
- verificare i flag di wizard `marketingConsent` e `wantAgenciesValuation`,
- tracciare l’origine del lead (data/ora, source, ecc. – già presente nel DB con `createdAt`).

---

## 7. Gestione dei diritti degli interessati (art. 15–22 GDPR)

Procedura consigliata:

1. **Ricezione richiesta**
   - L’utente contatta il titolare via email/PEC o modulo contatti.
   - Identificare chiaramente:
     - chi è (email, telefono, eventuale nome),
     - che diritto vuole esercitare (accesso, cancellazione, rettifica, opposizione, portabilità, ecc.).

2. **Identificazione nei sistemi**
   - Accedere alla dashboard admin.
   - Cercare il contatto per email o telefono.
   - Verificare che i dati corrispondano alla richiesta (cross-check su immobile e data valutazione se necessario).

3. **Azioni tipiche**
   - **Accesso (art. 15)**:
     - Esportare i dati del lead (contatto, immobile, valutazione, wizardData).
     - Inviare all’utente un riepilogo leggibile (possibilmente in PDF) dei dati detenuti.
   - **Rettifica (art. 16)**:
     - Modificare i dati errati direttamente nel DB o in una interfaccia di editing admin (se esistente).
   - **Cancellazione (art. 17)**:
     - Eliminare il lead dal DB (via API admin “delete lead” o comando manuale controllato).
     - Verificare eventuali copie secondarie (backup) e politiche di retention.
   - **Limitazione (art. 18)**:
     - Marcare il lead come “bloccato” (es. flag manuale in DB) ed evitare ulteriore uso per marketing/statistiche individuali.
   - **Portabilità (art. 20)**:
     - Esportare i dati in formato strutturato (JSON, CSV).
   - **Opposizione (art. 21)**:
     - Interrompere il marketing diretto, aggiornare `marketingConsent` a false e registrare la richiesta.

4. **Tempi di risposta**
   - Standard: entro 1 mese dal ricevimento (prorogabile in casi complessi, con comunicazione all’interessato).

5. **Documentazione**
   - Registrare la richiesta e la risposta in un file interno:
     - `[DA COMPILARE – es. RegistroRichieste_GDPR.xlsx]`

---

## 8. Conservazione dei dati

Durate consigliate (parametrizzabili, ma già coerenti con la policy):

- **Lead e valutazioni**: 12–24 mesi dall’ultima interazione.
- **Dati per marketing**: fino a revoca del consenso, comunque non oltre 24 mesi.
- **Log tecnici**: 6–12 mesi (salvo indagini su incidenti di sicurezza).
- **Dati in backup**: secondo policy di backup (es. rotazione 30/90 giorni).

Operativamente:

- prevedere un job periodico/manuale che:
  - seleziona i lead più vecchi di X mesi,
  - li cancella o anonimizza,
  - registra un log dell’operazione.

---

## 9. Misure di sicurezza tecniche e organizzative

Esempio di misure già in linea con l’app:

- **Controllo accessi**
  - Area admin accessibile solo con login e token.
  - Possibilità di integrare 2FA (OTP) sul backend admin.
- **Separazione ambiente utente/admin**
  - UI utente e dashboard staff separate.
- **Protezione dati in transito**
  - Utilizzo di HTTPS in produzione (da configurare sul reverse proxy).
- **Protezione dati a riposo**
  - DB SQLite con accesso solo dal server applicativo.
  - Cartella upload protetta a livello server (no listing pubblico).
- **Logging e monitoraggio**
  - Log accessi admin e errori backend.
  - Possibilità di identificare attività sospette tramite log.
- **Procedure operative**
  - Ruoli chiari: chi può accedere alla dashboard, chi può cancellare lead, chi gestisce richieste GDPR.
  - Documentazione di data breach (vedi sezione successiva).

---

## 10. Gestione data breach (schema operativo minimo)

In caso di violazione dei dati personali:

1. **Rilevazione**
   - Un admin rileva accesso non autorizzato o fuga di dati (es. email inviate al destinatario sbagliato, leak di DB, ecc.).

2. **Contenimento**
   - Immediate azioni tecniche:
     - blocco account compromessi,
     - disabilitazione accessi,
     - patch del bug.

3. **Valutazione**
   - Verificare:
     - natura dei dati coinvolti (contatti, immobile, note, ecc.),
     - numero di interessati,
     - possibili conseguenze per persone fisiche.

4. **Notifica**
   - Se la violazione comporta rischio per i diritti e le libertà degli interessati:
     - notifica al Garante Privacy entro 72 ore (art. 33 GDPR), se applicabile;
     - e, nei casi gravi, informativa agli interessati (art. 34 GDPR).

5. **Documentazione**
   - Conservare un “Registro data breach” interno con:
     - data evento, descrizione, sistemi coinvolti, dati coinvolti, azioni intraprese, eventuali notifiche.

---

## 11. Controlli futuri: checklist rapida

In caso di ispezione o audit, preparare:

- Documenti:
  - Questo documento `.md` aggiornato.
  - Privacy policy completa (versione pubblicata + eventuale PDF).
  - Registro formale dei trattamenti (art. 30 GDPR).
  - Lista fornitori e contratti (Groq, hosting, mail provider, ecc.).
  - Registro richieste interessati.
  - Eventuali registri data breach.

- Evidenze tecniche:
  - Screenshot della dashboard admin (registro trattamenti, elenco lead).
  - Estratto log accessi admin (dimostrare controllo accessi).
  - Configurazione HTTPS (certificati, configurazione server).

- Evidenze organizzative:
  - Elenco ruoli e autorizzazioni (chi ha accesso a cosa).
  - Procedura scritta per richieste GDPR (anche breve).
  - Procedura scritta per data breach.

---

## Allegato A – Informativa Privacy per gli utenti (testo completo)

> Da utilizzare nel modale “Privacy policy”, come testo sul sito/app.

### 1. Introduzione

La presente informativa descrive le modalità di trattamento dei dati personali degli utenti che utilizzano il servizio di valutazione immobiliare online, ai sensi del Regolamento (UE) 2016/679 (“GDPR”) e del D.lgs. 196/2003 come modificato dal D.lgs. 101/2018 (“Codice Privacy”).

### 2. Titolare del trattamento

- Titolare del trattamento: **[DA COMPILARE – Nome/Ragione sociale]**  
- Sede legale: **[DA COMPILARE – indirizzo completo]**  
- Contatti: **[DA COMPILARE – email privacy / PEC / telefono]**

Il titolare determina le finalità e i mezzi del trattamento dei dati personali raccolti tramite il servizio di valutazione immobiliare.

### 3. Eventuale Responsabile della Protezione dei Dati (RPD/DPO)

Se nominato:

- DPO: **[DA COMPILARE – Nome / società]**  
- Contatto DPO: **[DA COMPILARE – email]**

Se non nominato:

> Il titolare non ha ritenuto necessario nominare un Responsabile della Protezione dei Dati (RPD/DPO ai sensi dell’art. 37 GDPR).

### 4. Tipologie di dati trattati

Vedasi §3 del presente documento (dati anagrafici, dati immobile, dati wizard, file caricati, dati tecnici/log).

### 5. Finalità e basi giuridiche

Vedasi §4:  
- valutazione immobiliare (art. 6.1.b),  
- gestione lead (art. 6.1.b/f),  
- analisi interne (art. 6.1.f),  
- marketing e agenzie di zona (art. 6.1.a + art. 130 Codice Privacy),  
- sicurezza e difesa in giudizio (art. 6.1.f/c).

### 6. Natura del conferimento

- Obbligatorio per i dati necessari alla valutazione e al contatto.
- Facoltativo per dati aggiuntivi (planimetrie, foto, dettagli extra).
- Facoltativo e separato per consenso marketing e agenzie di zona.

### 7. Modalità del trattamento

- Strumenti elettronici e informatici;
- Principi di minimizzazione, sicurezza, trasparenza;
- Accesso limitato a personale autorizzato e responsabili del trattamento.

### 8. Conservazione dei dati

- Lead e valutazioni: 12–24 mesi dalla valutazione o ultima interazione.
- Marketing: fino a revoca, max 24 mesi.
- Log tecnici: 6–12 mesi salvo casi particolari.

### 9. Comunicazione e destinatari

- Personale interno del titolare;
- Fornitori IT e hosting;
- Consulenti (legali, fiscali) ove necessario;
- Agenzie immobiliari partner solo in presenza di consenso specifico;
- Autorità pubbliche se richiesto dalla legge.

### 10. Trasferimenti verso Paesi terzi

Possibili tramite:

- servizi di AI (Groq) e geocoding;
- eventuali fornitori hosting/email extra-SEE.

In tali casi il titolare adotta garanzie adeguate (es. clausole contrattuali tipo, decisioni di adeguatezza, ecc.).

### 11. Diritti dell’interessato

L’utente può esercitare:

- diritto di accesso, rettifica, cancellazione, limitazione, portabilità, opposizione;
- diritto di revoca del consenso in qualsiasi momento;
- diritto di proporre reclamo al Garante Privacy.

Modalità: tramite i contatti del titolare indicati sopra.

### 12. Processi decisionali automatizzati

La valutazione immobiliare è supportata da sistemi automatizzati (es. AI), ma:

- non produce decisioni unicamente automatizzate con effetti giuridici rilevanti;
- ha natura indicativa e non sostituisce una valutazione professionale in loco.

### 13. Sicurezza

Il titolare adotta misure tecniche e organizzative adeguate per proteggere i dati, tra cui:

- controllo accessi area admin;
- protocolli sicuri in produzione;
- logging;
- procedure interne.

### 14. Aggiornamenti

La presente informativa può essere aggiornata. La versione più recente è resa disponibile nell’applicazione e/o sul sito del titolare.

---

_Fine documento._