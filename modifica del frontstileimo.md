- il ruolo generale,
- le sezioni principali,
- le variabili di stato importanti,
- cosa fa ogni blocco/funzione rilevante,
- come si collega agli altri file.
Parto dai due più importanti per il flusso utente (frontend) e la valutazione (backend). Se ti va bene questo livello di dettaglio, nei messaggi successivi posso fare lo stesso sugli altri file specifici che ti interessano.

1. src/App.jsx – Cuore del frontend

Ruolo:

- Controlla gran parte dell’app:
  - flusso del wizard di valutazione,
  - landing (home, pre, province, blog, pagine legali),
  - gestione stato globale (indirizzo, immobile, valutazione, lead, modal),
  - dashboard staff (area admin).
Blocchi principali (in ordine logico):

- Import
  
  - Importa React, hook ( useState , useEffect , useRef , ecc.), componenti (form, mappa, blog, wizard lead, footer), servizi (OMI, leads, adminLeadsService, Groq, ecc.), e librerie di animazione come gsap .
- Stato globale dell’app (varie chiamate a useState ):
  
  - currentPage : stringa che rappresenta “dove” sei nell’app:
    - 'home' , 'pre' , 'address' , 'property' , 'valuation' , 'blog' , 'blog-article' , 'province-landing' , 'privacy' , 'terms' , 'cookies' , 'contact' , 'support' , ecc.
  - wizardStep : step interno del wizard di valutazione (es. landing_address , main_features , exposure_question , ecc.).
  - draftAddress , selectedAddress :
    - draftAddress → input corrente mentre compili l’indirizzo,
    - selectedAddress → indirizzo definitivo scelto e usato per OMI/valutazione.
  - omiData : risultati OMI (valori min/max/avg €/mq, affidabilità, tipo fonte).
  - propertyDraft : dati dell’immobile (superficie, piano, stato, spazi esterni, ecc.).
  - wizardData : oggetto più grande che contiene sottosezioni:
    - extra , lead , ecc. (cioè risposte a domande extra, profilo utente, tempistiche vendita, consensi).
  - valuationResult : oggetto con il risultato della valutazione (prezzo minimo/medio/massimo, €/mq).
  - contactData : dati del contatto (nome, email, telefono, note) se l’utente compila il form.
  - isValuationUnlocked : se la valutazione è già stata “sbloccata” (es. dopo media/AI).
  - valuationId : id valutazione salvata nel backend.
  - loading , error : gestiscono gli stati di caricamento e gli errori globali.
  - isLeadModalOpen , showContactPopup : controllano la visibilità di modali/popup.
  - isAdminDashboard , adminTab , selectedLead ecc.: gestiscono la dashboard staff.
- Effetto su document.title e meta description
  
  - Un useEffect osserva currentPage , selectedAddress , currentProvinceSlug , ecc., e setta:
    - document.title
    - meta description
  - Casi distinti per:
    - home, address, property, valuation,
    - landing di provincia,
    - privacy, termini, cookie, contatti, centro assistenza,
    - blog e singolo articolo.
- Parsing dell’URL iniziale ( useEffect con new URL(window.location.href) ):
  
  - Legge pathname e parametri ( admin , slug blog, slug provincia).
  - Calcola flag tipo:
    - pathIsRoot , pathIsPrivacy , pathIsTerms , pathIsCookies , pathIsPre , pathIsHome , pathIsValutazione , pathIsContact , pathIsSupport , route per blog e province.
  - In base a questi:
    - imposta currentPage ,
    - imposta wizardStep iniziale ( landing_address ),
    - se è admin ( admin=ValutatoreStaff2025! ), entra in modalità dashboard staff.
- Funzioni di navigazione “pagine”
  
  - goToHomePage , goToValuationPage , goToPrivacyPage , goToTermsPage , goToCookiesPage ,
     goToContactPage , goToHelpCenterPage , goToFaqPage , ecc.
  - Tutte:
    - aggiornano currentPage ,
    - resettano alcuni stati (es. currentBlogSlug , wizardStep ),
    - aggiornano l’URL con window.history.pushState / replaceState ,
    - fanno window.scrollTo(0,0) .
- Funzioni specifiche del wizard
  
  - Ricerca indirizzo / primo step:
    
    - handleAddressSelect(enrichedAddress) :
      - riceve indirizzo scelto da StepByStepAddressForm ,
      - chiama il servizio OMI per avere i valori €/mq (via omiService o realOmiService ),
      - salva selectedAddress e omiData ,
      - sposta currentPage allo step proprietà ( 'property' ) e aggiorna wizardStep .
  - Form proprietà:
    
    - handlePropertySubmit(property) :
      - riceve i dati dell’immobile da PropertyForm ,
      - chiama il backend ( /api/valuation/enhanced-omi ) per calcolare la valutazione usando OMI ufficiale + fallback,
      - salva valuationResult , valuationId , eventuali metadati (affidabilità, fonte),
      - sposta currentPage a 'valuation' .
  - Gestione media e AI:
    
    - funzioni che:
      - inviano planimetrie/foto ( /api/valuation/media ),
      - richiedono analisi AI ( /api/valuation/ai-analyze ),
      - aggiornano la valutazione con applyMediaDeltaToValuation (prezzo corretto in base a stato/qualità).
  - Gestione lead:
    
    - Funzioni chiamate da LeadQualificationWizard , ContactForm , ContactFormPopup :
      - costruiscono il payload con:
        - dati immobile ( propertyDraft ),
        - dati lead ( wizardData.lead ),
        - valutazione,
        - consensi (marketing, agenzie),
        - e li spediscono al backend via leadsService .
  - Navigazione interna wizard:
    
    - goBack() :
      - gestisce il ritorno indietro tra step (es. da property a address, da valuation a property).
    - restart() :
      - resettone globale del wizard (torni alla landing di indirizzo, reset stato immobile/valutazione).
- Rendering principale ( return )
  
  - Struttura base:
    
    - <div className="min-h-screen ...">
      - header/top bar (spesso con CTA per “Inizia la valutazione”),
      - blocco centrale con currentPage :
        - pagina pre ( pre ), home ( home ), wizard, blog, landing di provincia, pagine legali,
      - footer ( <MainFooter ... /> ).
  - Wizard principale (quando currentPage è 'address' | 'property' | 'valuation' ):
    
    - <ValuationWizardPage ...> che riceve quasi tutto lo stato e le funzioni come props:
      - wizardStep ,
      - draftAddress , selectedAddress , omiData ,
      - wizardData , propertyDraft , valuationResult ,
      - setWizardData , setPropertyDraft , handleAddressSelect , handlePropertySubmit , goBack , restart .
  - Pagine legali :
    
    - currentPage === 'privacy' → contenuto lungo con policy e registro, che hai visto.
    - currentPage === 'terms' → i termini di utilizzo che abbiamo appena completato.
    - currentPage === 'cookies' → cookie & consenso (categorie, Google Analytics, social, gestione consenso).
  - Blog :
    
    - currentPage === 'blog' → elenco articoli filtrabili per categoria.
    - currentPage === 'blog-article' → dettaglio articolo.
  - Landing di provincia :
    
    - currentPage === 'province-landing' → pagina dedicata alla città/provincia con testi mirati e CTA verso valutazione.
  - Dashboard staff :
    
    - quando in modalità admin, la pagina mostra tab per:
      - lista lead (tab overview),
      - dettagli contatto,
      - analytics landing,
      - GDPR/registro trattamenti, ecc.
2. server/index.js – API backend

(non abbiamo ancora aperto il file, ma la documentazione HTML lo descrive chiaramente; qui ti faccio una mappa concettuale)

Ruolo:

- Server Express che espone gli endpoint REST usati dal frontend.
Struttura tipica:

- Import:
  
  - express , cors , body-parser / express.json() ,
  - db (da server/db.js ),
  - OmiOfficialRepository ,
  - servizi per OMI sintetico ( realOmiService ),
  - funzioni per AI/media (Groq, storage file).
- Configurazione app:
  
  - const app = express();
  - middleware:
    - cors() per CORS,
    - express.json() per body JSON,
    - eventuale gestione static files per upload.
- Endpoint pubblici valutazione :
  
  - POST /api/valuation/enhanced-omi
    - legge corpo richiesta (indirizzo + property),
    - cerca dati OMI ufficiali nel DB,
    - se disponibili → calcola range €/mq e valore,
    - se non disponibili → chiama realOmiService per fallback,
    - ritorna valuation e metadati ( source , reliability , ecc.).
  - POST /api/valuation/media
    - riceve upload planimetrie/foto (multer o simili),
    - salva su disco,
    - registra record media in SQLite,
    - ritorna mediaId .
  - POST /api/valuation/ai-analyze
    - invia media/descrizione a Groq AI,
    - riceve punteggi/statistiche,
    - salva analisi, ritorna risultato al frontend.
- Endpoint per leads :
  
  - POST /api/leads
    - riceve dati contatto + wizardData + valutazione + consensi,
    - inserisce record nelle tabelle users_leads , lead_media , lead_ai_analysis ,
    - ritorna leadId e stato.
- Endpoint admin (protetti con JWT):
  
  - POST /api/admin/login → login admin.
  - GET /api/admin/leads → lista lead con filtrini/paginazione.
  - GET /api/admin/leads/:id → dettaglio singolo lead (con media, analisi AI).
  - GET /api/admin/analytics/province → statistiche landing di provincia.
  - Altri endpoint per esport, ricerca, ecc.
- Avvio server:
  
  - app.listen(PORT, () => { console.log(...) }) .
3. server/db.js – Database SQLite

Ruolo:

- Connessione e schema database per:
  - lead,
  - media,
  - analytics,
  - eventualmente altre tabelle.
Struttura tipica:

- Import:
  
  - better-sqlite3 o sqlite3 ,
  - path per costruire il percorso del file .sqlite .
- Connessione:
  
  - const db = new Database(path.resolve(__dirname, '../data/database.sqlite'));
- Funzione di inizializzazione:
  
  - db.exec con CREATE TABLE IF NOT EXISTS per:
    - users_leads (id, dati contatto, address, step_data, valuation_data, consensi, created_at),
    - lead_media (media associati a lead),
    - lead_ai_analysis ,
    - province_analytics_events .
- Helper per query:
  
  - getLeadById(id) ,
  - listLeads(filters) ,
  - insertLead(data) ,
  - insertMedia(leadId, fileMeta) ,
  - insertAnalyticsEvent(event) .
- Export:
  
  - module.exports = { db, getLeadById, listLeads, ... } .
4. src/services/omiService.js – Wrapper OMI

Ruolo:

- Astrazione unica per ottenere valori OMI (€/mq) da usare nella valutazione.
Struttura tipica:

- Import:
  
  - realOmiService (sintetico),
  - eventuale chiamata a backend per OMI ufficiale o parametri regionali.
- Funzioni:
  
  - getOmiValuesForAddress(address) :
    - legge address.postcode , city , state ,
    - prova a ottenere valori:
      - se il backend fornisce OMI ufficiali → li usa,
      - altrimenti → fallback su realOmiService .
    - ritorna oggetto tipo:
      ```
      {
        min: number,
        avg: number,
        max: number,
        reliability: 
        'UFFICIALE_COMUNALE' | 
        'SINTETICO_CAP' | ...,
        source: 'omi-official' | 
        'real-omi-fallback'
      }
      ```
- Il resto dell’app, soprattutto App.jsx , non deve sapere come vengono calcolati: chiama solo questa interfaccia.
5. src/components/StepByStepAddressForm.jsx – Wizard indirizzo

Ruolo:

- UI che guida l’utente nella scelta dell’indirizzo in più step:
  - step 1: città,
  - step 2: via,
  - step 3: numero civico,
  - step 4/5: conferma + CAP.
Struttura:

- Stato locale:
  
  - step : numero dello step corrente,
  - campi input ( city , street , houseNumber , ecc.),
  - suggestions : lista di indirizzi dal servizio enhancedAddressService ,
  - selectedSuggestion : indirizzo scelto.
- Effetti:
  
  - useEffect che, quando city / street cambiano, chiama il servizio di autocomplete (con debounce) e popola suggestions .
- Handlers:
  
  - handleCityChange , handleStreetChange , handleHouseNumberChange , ecc.
  - handleSuggestionClick(suggestion) :
    - seleziona l’indirizzo,
    - riempie i campi corrispondenti,
    - passa allo step successivo.
  - confirmAddress() :
    - costruisce un enrichedAddress con:
      - display , street , housenumber , city , state , postcode , lat , lon ,
    - chiama props.onAddressSelect(enrichedAddress) → cioè handleAddressSelect in App.jsx .
- Render:
  
  - mostra step numerati, input, elenco suggerimenti, pulsanti “Avanti” / “Indietro” / “Valuta” con logica di abilitazione.