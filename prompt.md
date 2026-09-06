Voglio implementare un nuovo “data layer” OMI ufficiale basato su un DATABASE SEPARATO (SQLite), senza GIS.

Obiettivo finale (claim difendibile):
- “Usiamo valori OMI ufficiali (min/max €/mq) del semestre X”
- senza assegnare una singola zona all’immobile (perché NON usiamo GIS)
- quindi reliability base deve essere OFFICIAL_COMUNE_ONLY, non OFFICIAL_STRICT.

Percorsi sorgenti ufficiali:

1) CAP / Comuni (JSON):
C:\Users\lucat\Desktop\facile valutare\Valutatore con componenti punti di forza\gi_db_comuni-2026-01-31-6fcd8\json
File presenti:
- gi_cap.json
- gi_comuni.json
- gi_comuni_cap.json
- gi_comuni_nazioni_cf.json
- gi_comuni_validita.json
- gi_nazioni.json
- gi_province.json
- gi_regioni.json

2) OMI ufficiale (molte sottocartelle, CSV + PDF):
C:\Users\lucat\Desktop\facile valutare\Valutatore con componenti punti di forza\omi
Dentro ci sono file con pattern:
- *_ZONE.csv
- *_VALORI.csv
(Importare TUTTI i semestri/anni presenti)

Vincoli architetturali (IMPORTANTI):
- Il database OMI deve essere un file separato dal DB lead (non usare dev.sqlite).
- Esempio path progetto: data/omi_official.sqlite
- Il runtime deve leggere SOLO dal DB, niente parsing CSV/JSON a runtime.
- Niente più prefissi sintetici (ALL_ITALY_CAPS) per il flusso “ufficiale”.
- Non cambiare firme pubbliche:
  - endpoint backend: POST /api/valuation/enhanced-omi
  - frontend: calculateEnhancedValuation(property, address)
  Cambia solo “dietro”.

Senza GIS (regola chiave):
- NON assegnare una zona singola all’immobile.
- Per Comune + Semestre + Tipologia, calcolare un RANGE COMUNALE ufficiale così:
  min_comune_eur_mq = MIN(min_eur_mq) su tutte le zone del comune per quella tipologia
  max_comune_eur_mq = MAX(max_eur_mq) su tutte le zone del comune per quella tipologia
- zone_count_used = numero di zone coinvolte
- Questi min/max €/mq sono “OMI ufficiali” (range comunale).
- Il prezzo medio (se calcolato) è DERIVED.

Deliverable richiesti:

A) Schema DB (SQLite) in una migrazione o script init:
Tabelle minime:
1) comuni (con codice ISTAT come chiave naturale se disponibile)
2) province
3) regioni
4) cap (tabella cap univoca)
5) cap_comune (many-to-many CAP↔Comune)
6) omi_semesters (anno + semestre + codice es 2025_1)
7) omi_import_files (audit: path, hash, righe, esito, timestamp, tipo ZONE/VALORI)
8) omi_zones
   - chiave naturale: (id_semestre, id_comune, codice_zona_omi)
9) omi_values
   - FK a omi_zones
   - includere campi che identificano la tipologia/categoria e eventuali dimensioni (stato manutentivo ecc se nel CSV)
   - min_eur_mq, max_eur_mq
   - FK a omi_import_files
Indici:
- cap.cap
- cap_comune(cap_id, comune_id)
- omi_zones(id_semestre, id_comune)
- omi_values(id_zone, tipologia/categoria, eventuale stato)

B) Script import CLI (Node 18+), idempotente:
- file: scripts/import-omi-official-db.mjs
- parametri CLI:
  --capPath="...json"
  --omiPath="...omi"
  --dbPath="data/omi_official.sqlite"
- comportamento:
  1) crea DB e tabelle se non esistono
  2) importa anagrafiche (regioni/province/comuni)
  3) importa cap + relazione cap_comune (supportare CAP associati a più comuni)
  4) scansiona ricorsivamente omiPath
     - trova tutti *_ZONE.csv e *_VALORI.csv
     - determina semestre dal nome file (es: 20251 => anno 2025 semestre 1; 20252 => 2025 semestre 2)
     - calcola hash file
     - se hash già importato con esito OK => salta
  5) importa ZONE prima, poi VALORI
  6) log import in omi_import_files (righe lette/importate, errori)
  7) gestione “orfani”: valori senza zona trovata => loggare in modo evidente (e non crashare tutto)

C) Repository backend per lettura DB (read-only):
- file: server/services/OmiOfficialRepository.js
- deve aprire il DB separato (path configurabile con env OMI_DB_PATH, fallback data/omi_official.sqlite)
- metodi:
  1) findComuniByCap(cap) -> lista comuni possibili (con provincia/regione)
  2) getComuneOmiRange({ comuneId, semestreCode, tipologia }) ->
     {
       semestre,
       comune,
       min_eur_mq,
       max_eur_mq,
       zone_count_used,
       sources: [{file_path, file_hash, tipo_file, semestre}],
     }
  Nota: tipologia va mappata (vedi punto D) e deve matchare i valori presenti in omi_values.

D) Mappatura tipologia UI -> categoria OMI (senza inventare):
- definire un mapping esplicito e documentato, tipo:
  Appartamento/Attico/Villa/Villetta -> “Residenziale” (o la categoria reale del CSV)
- Se non trovi una categoria coerente nel DB:
  - NON forzare: ritorna errore no_omi_category_match oppure degrada a DERIVED con motivazione (ma non OFFICIAL).
- La mappatura deve essere centralizzata in un file tipo:
  server/services/omiCategoryMapping.js

E) Integrazione nell’endpoint esistente /api/valuation/enhanced-omi:
- modificare SOLO il fallback cap-based (buildCapBasedValuation):
  1) estrai cap dall’indirizzo
  2) lookup comuniByCap(cap)
     - se 0 => INVALID_CAP (niente OMI ufficiale)
     - se >1 => prova a disambiguare usando address.city/province dal geocoding; se non risolvi => AMBIGUOUS_CAP
  3) usa comune scelto + semestre attivo (da omi_semesters.is_active=1) per calcolare range comunale
  4) calcola prezzi:
     prezzoMin = round(min_eur_mq * mq)
     prezzoMax = round(max_eur_mq * mq)
     prezzoMedio = round((prezzoMin + prezzoMax)/2)  -> DERIVED
  5) risposta JSON deve includere SEMPRE:
     omiOfficial: { semestreCode, comune, provincia, cap, min_eur_mq, max_eur_mq, zone_count_used, sources[] }
     valutazione: { prezzoMinimo, prezzoMassimo, prezzoMedio, mq }
     reliability: { base: "OFFICIAL_COMUNE_ONLY", final: "DERIVED" }
- NON usare ALL_ITALY_CAPS in questo percorso “ufficiale”.
- Mantieni ALL_ITALY_CAPS solo come fallback separato e marcato INTERPOLATED/ESTIMATED (non “ufficiale”).

F) Aggiornare gli script batch:
- invece di generare CAP random, estrai un campione di CAP reali dal DB (es. 100 random da cap table)
- assicurati che nei report:
  - CAP 20029 risulti Turbigo (non Milano)
  - tutti i CAP siano reali
  - nessun record venga etichettato OFFICIAL_STRICT (perché no GIS)

Output richiesto da te (Trae):
1) schema DB finale
2) struttura file nel progetto
3) script import completo
4) repository + query principali
5) modifiche a buildCapBasedValuation e formato risposta
6) comandi npm:
   "import:omi": "node scripts/import-omi-official-db.mjs --capPath=... --omiPath=... --dbPath=data/omi_official.sqlite"

Obiettivo non negoziabile:
- poter rispondere “da dove viene questo numero” con semestre + file hash + range ufficiale comunale.