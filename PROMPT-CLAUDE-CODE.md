# Prompt per Claude Code (estensione VS Code)

Copia e incolla i due prompt qui sotto **in sequenza** (prima il PROMPT 1, verifica che funzioni tutto in locale, poi il PROMPT 2 per il deploy). Sono scritti per essere autosufficienti: Claude Code non ha memoria di questa chat, quindi contengono tutto il contesto necessario.

---

## PROMPT 1 — Completare sviluppo (dominio, listmonk, Stripe)

```
Lavoro sul progetto "Valuta Facile", un portale di valutazione immobiliare (Vite/React + Node/Express, root del repo). Devo completare 3 cose prima del deploy in produzione. Leggi prima SETUP-GUIDE.md, docker-compose.prod.yml e .env.prod per il contesto completo, poi procedi task per task.

TASK A — Fix dominio errato
Il dominio ufficiale registrato è "valutafacile.it", ma nel progetto trovo scritto "facilevalutare.it" (probabile refuso, lettere invertite). Cerca in tutto il repo (incluso .env.prod, SETUP-GUIDE.md, e qualunque file sorgente) tutte le occorrenze di "facilevalutare.it" e sostituiscile con "valutafacile.it" (mantieni www. dove presente). Segnalami se trovi il dominio sbagliato usato anche in posti inattesi (es. commenti, config CORS, redirect hardcoded).

TASK B — Automatizzare setup listmonk (niente click manuali in UI)
Il file SETUP-GUIDE.md descrive un processo manuale via interfaccia web di listmonk per creare 4 liste e 4 template transazionali (i contenuti HTML esatti sono lì, PARTE 1 e PARTE 2). Voglio automatizzare tutto questo via API invece che a mano:

1. Verifica la documentazione ufficiale delle API di listmonk (https://listmonk.app/docs/apis/) per gli endpoint corretti di creazione liste (POST /api/lists) e template transazionali (POST /api/templates), inclusi i campi richiesti e il tipo di autenticazione (Basic Auth con le credenziali admin).
2. Scrivi uno script (Node, in scripts/setup-listmonk.mjs) che:
   - Legge le credenziali admin di listmonk da .env.prod (LISTMONK_URL, LISTMONK_USERNAME, LISTMONK_PASSWORD).
   - Crea le 4 liste esattamente come descritte in SETUP-GUIDE.md (Tutti gli Utenti/pubblica/single, Clienti Paganti/privata/single, Utenti Free/privata/single, Newsletter/pubblica/double optin).
   - Crea i 4 template transazionali con l'HTML esatto già presente in SETUP-GUIDE.md (welcome, magic-link-video, report-pronto-pagamento, visura-pronta), sostituendo "facilevalutare.it" con "valutafacile.it" nei testi.
   - Lo script deve essere idempotente: se una lista/template con lo stesso nome esiste già, non duplicarlo, riusa l'ID esistente.
   - Alla fine, scrive automaticamente gli ID ottenuti nelle variabili corrette di .env.prod (LISTMONK_LIST_*, LISTMONK_TEMPLATE_*), senza toccare il resto del file.
3. Verifica se listmonk supporta la configurazione SMTP via variabili d'ambiente/config (non solo da UI) — controlla la doc ufficiale sul formato config.toml e le relative env var (pattern tipo LISTMONK_smtp__0__host, da confermare sulla documentazione, non dare per scontata la sintassi). Se è possibile, aggiungi le variabili SMTP mancanti a docker-compose.prod.yml/.env.prod per Brevo (host smtp-relay.brevo.com, porta 587) lasciando dei placeholder chiari (USERNAME/PASSWORD da compilare) invece che farmelo fare via UI. Se l'API/config non lo permette in modo affidabile, dimmelo chiaramente e lascia il passaggio manuale via UI documentato in SETUP-GUIDE.md PARTE 3.

TASK C — Configurare Stripe (prodotto + webhook) con il plugin ufficiale
Ho già installato il plugin Stripe in Claude Code (/plugin install stripe@claude-plugins-official) e in .env.prod sono già presenti le chiavi di TEST/sandbox (STRIPE_SECRET_KEY e VITE_STRIPE_PUBLISHABLE_KEY, entrambe pk_test_/sk_test_). Non serve creare uno script custom: usa gli strumenti del plugin Stripe per:
1. Creare il prodotto "Report Valutazione Immobiliare" con prezzo one-time di 5.00 EUR (usa la chiave sk_test_ già presente in .env.prod), e scrivere l'ID prezzo ottenuto in STRIPE_PRICE_ID dentro .env.prod.
2. Creare un webhook endpoint verso https://valutafacile.it/api/payment/webhook in ascolto sull'evento checkout.session.completed, e scrivere il signing secret ottenuto in STRIPE_WEBHOOK_SECRET dentro .env.prod. Se l'endpoint pubblico non è ancora raggiungibile (deploy non ancora fatto), usa in alternativa "stripe listen --forward-to localhost:4000/api/payment/webhook" per i test locali e nota il webhook secret temporaneo generato, aggiornandolo poi con quello definitivo dopo il deploy.
3. Verifica con il plugin che le chiavi in .env.prod siano valide (una chiamata di test all'API Stripe) prima di proseguire.
4. Ricordami chiaramente che queste sono chiavi di TEST: prima di andare live con pagamenti reali degli utenti, vanno sostituite con le chiavi live (sk_live_/pk_live_) da Developers → API keys sulla dashboard Stripe, e va rifatto anche il prodotto/webhook in modalità live (gli oggetti test e live sono separati su Stripe).

TASK D — Verifica finale
Dopo aver completato A, B, C: avvia il progetto in locale (npm run server + npm run dev, poi docker compose --profile setup up listmonk-setup e docker compose --profile run up postgres listmonk -d se serve) e ripercorri la checklist "Test End-to-End" già presente in SETUP-GUIDE.md (Test 1-6), segnalandomi eventuali errori.

Fammi un riepilogo finale di cosa hai automatizzato, cosa resta da fare manualmente (es. chiavi Stripe live, credenziali SMTP reali, verifica dominio email su Brevo/Resend) e quali file hai modificato.
```

---

## PROMPT 2 — Deploy su GitHub + VPS (dietro Traefik, senza toccare il progetto esistente)

```
Devo mettere online questo progetto ("Valuta Facile") su una VPS Hostinger che ha già un altro progetto Docker in produzione (un CRM, nome progetto Compose "crm-luca", cartella /opt/crm-luca) che NON devo assolutamente toccare o rischiare di rompere.

Contesto tecnico della VPS (già verificato via SSH):
- Ubuntu 24.04, Docker + Docker Compose installati.
- Reverse proxy: Traefik, container "traefik-traefik-1", in esecuzione con network_mode: host (ascolta direttamente su 80/443 dell'host), provider Docker con exposedbydefault=false (quindi legge le label sui container per capire cosa esporre), certificati SSL automatici via Let's Encrypt (HTTP challenge, certresolver "letsencrypt").
- Il CRM esistente è raggiungibile grazie a label Traefik sul suo container frontend (porta interna 3000), NON pubblica porte sull'host — Traefik lo raggiunge direttamente sulla rete bridge Docker del progetto CRM, perché essendo in host network mode Traefik può risolvere gli IP dei container sulle reti bridge dell'host.
- File compose di Traefik: /docker/traefik/docker-compose.yml (non toccarlo).

Il mio nuovo progetto ha un docker-compose.prod.yml con due servizi principali: "backend" (Node/Express, porta interna 4000) e "frontend" (nginx che serve la build React sulla porta 80 e fa da reverse proxy interno per /api/ verso backend:4000, vedi nginx.conf). Il dominio ufficiale è valutafacile.it (con www).

Voglio che tu:

1. Modifichi docker-compose.prod.yml così:
   - Aggiungi in cima un campo `name: valutafacile` a livello di progetto Compose, per isolarlo esplicitamente da qualunque altro progetto sulla VPS (incluso crm-luca), indipendentemente dal nome della cartella.
   - Rimuovi la pubblicazione di porte sull'host per "frontend" (niente "80:80"/"443:80") — Traefik ci arriva direttamente via rete bridge, e pubblicare la porta 80 sull'host andrebbe in conflitto con Traefik che già ci sta ascoltando in modalità host.
   - Rimuovi la pubblicazione della porta 4000 per "backend" — non deve essere raggiungibile direttamente da internet, ci arriva già internamente il frontend via nginx.conf (proxy_pass verso backend:4000 dentro la rete Docker del progetto).
   - Se nel compose sono presenti anche listmonk/postgres: valuta se voglio esporre l'admin di listmonk pubblicamente. Se sì, non pubblicare la porta 9000 sull'host: aggiungi invece label Traefik dedicate per esporlo su un sottodominio tipo mail.valutafacile.it, con lo stesso pattern di router http/https e certresolver. Se non serve accesso pubblico, lascialo solo sulla rete interna del progetto.
   - Aggiungi al servizio "frontend" queste label Traefik (adatta i nomi router/service se preferisci una convenzione diversa, ma tienili univoci rispetto a "crm-luca"):
     - traefik.enable=true
     - traefik.http.routers.valutafacile-http.entrypoints=web
     - traefik.http.routers.valutafacile-http.rule=Host(`valutafacile.it`) || Host(`www.valutafacile.it`)
     - traefik.http.routers.valutafacile-http.service=valutafacile-service
     - traefik.http.routers.valutafacile-https.entrypoints=websecure
     - traefik.http.routers.valutafacile-https.rule=Host(`valutafacile.it`) || Host(`www.valutafacile.it`)
     - traefik.http.routers.valutafacile-https.service=valutafacile-service
     - traefik.http.routers.valutafacile-https.tls=true
     - traefik.http.routers.valutafacile-https.tls.certresolver=letsencrypt
     - traefik.http.services.valutafacile-service.loadbalancer.server.port=80
     - traefik.http.services.valutafacile-service.loadbalancer.server.scheme=http

2. Conferma che .env, .env.prod e varianti restino esclusi da git (controlla .gitignore, dovrebbero già esserlo) — non devono mai finire su GitHub perché contengono segreti (Stripe, Groq, JWT secret, password DB).

3. Preparami la sequenza esatta di comandi git per committare e pushare le modifiche (branch attuale, messaggio di commit sensato).

4. Scrivimi la checklist di comandi da eseguire via SSH sulla VPS per il deploy, assumendo che il repo sia su GitHub e che io lavori sempre con lo stesso flusso (push da locale, poi pull/clone sulla VPS + docker compose up):
   - Creazione cartella dedicata /opt/valutafacile (o nome a scelta, diverso da /opt/crm-luca)
   - Clone del repo lì dentro
   - Come trasferire in modo sicuro il file .env.prod sulla VPS (via scp dal mio PC, NON committato su git) dato che contiene segreti
   - Comando docker compose corretto per buildare e avviare (con -p valutafacile per essere espliciti sul nome progetto, e -f docker-compose.prod.yml)
   - Comandi per verificare che Traefik abbia rilevato il nuovo router (docker logs traefik-traefik-1 --tail 50) e che il certificato SSL sia stato emesso
   - Come verificare che crm-luca non abbia subito interruzioni (docker ps, controllo che i suoi container siano ancora "Up")

5. Ricordami di aggiornare il DNS di valutafacile.it: attualmente i nameserver sono quelli di parking di Hostinger (ns1/ns2.dns-parking.com), quindi il dominio non punta ancora da nessuna parte. Sulla VPS esegui `curl -4 ifconfig.me` per ottenere l'IP pubblico corrente, poi nel pannello Hostinger vai su Domains → valutafacile.it → DNS/Nameservers e aggiungi un record A per @ e uno per www puntati a quell'IP (oppure passa ai nameserver di Hostinger se il DNS è gestito altrove, poi aggiungi i record A dalla Zona DNS).

Alla fine fammi un riepilogo di tutti i file modificati e i comandi esatti da eseguire, in ordine, sia in locale che sulla VPS.
```

---

### Note rapide

- Il progetto è già nella cartella che hai condiviso con Claude in Cowork, quindi anche da qui posso leggerlo/modificarlo direttamente se preferisci lavorare senza passare per VS Code.
- `.env` e `.env.prod` sono già esclusi da `.gitignore`: corretto così, vanno trasferiti sulla VPS a parte (mai su GitHub).
- Il dominio `facilevalutare.it` scritto in `.env.prod` e in `SETUP-GUIDE.md` non corrisponde al dominio ufficiale `valutafacile.it` registrato su Hostinger — il PROMPT 1 lo corregge.
