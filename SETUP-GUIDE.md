# Guida Configurazione Servizi Esterni — Valuta Facile

> Questa guida copre tutto ciò che non è codice: configurazione manuale di listmonk, Stripe e AdSense.
> Segui i passi nell'ordine indicato. Alla fine trovi la checklist di test end-to-end.

---

## Prerequisiti

Prima di iniziare, assicurati che il server sia avviato (`npm run server`) e che listmonk sia raggiungibile su `http://localhost:9000`.

```bash
# Avvio listmonk (prima volta — setup DB)
docker compose --profile setup up listmonk-setup

# Avvio normale (tutte le volte successive)
docker compose --profile run up postgres listmonk -d
```

---

## PARTE 1 — listmonk: Liste

### Passo 1.1 — Aprire listmonk

1. Vai su `http://localhost:9000`
2. Accedi con le credenziali impostate in `.env`:
   - Username: valore di `LISTMONK_app__admin_username`
   - Password: valore di `LISTMONK_app__admin_password`

### Passo 1.2 — Creare le 4 liste

Vai su **Lists** (menu laterale) → clicca **+ New list**.

Crea le liste nell'ordine seguente (il numero ID che listmonk assegna dipende dall'ordine di creazione):

**Lista 1: Tutti gli Utenti**
- Name: `Tutti gli Utenti`
- Type: `Public`
- Optin: `Single`
- Tags: lascia vuoto
- → Clicca **Save**
- Nota l'ID assegnato (es. `1`)

**Lista 2: Clienti Paganti**
- Name: `Clienti Paganti`
- Type: `Private`
- Optin: `Single`
- → Clicca **Save**
- Nota l'ID (es. `2`)

**Lista 3: Utenti Free**
- Name: `Utenti Free`
- Type: `Private`
- Optin: `Single`
- → Clicca **Save**
- Nota l'ID (es. `3`)

**Lista 4: Newsletter**
- Name: `Newsletter`
- Type: `Public`
- Optin: `Double` ← importante per compliance GDPR
- → Clicca **Save**
- Nota l'ID (es. `4`)

### Passo 1.3 — Aggiornare .env con gli ID liste

Apri il file `.env` nella root del progetto e compila:

```env
LISTMONK_LIST_TUTTI_UTENTI=1
LISTMONK_LIST_CLIENTI_PAGANTI=2
LISTMONK_LIST_UTENTI_FREE=3
LISTMONK_LIST_NEWSLETTER=4
```

> Sostituisci i numeri con gli ID reali che listmonk ha assegnato — potrebbero essere diversi se hai già altre liste.

---

## PARTE 2 — listmonk: Template Transazionali

### Passo 2.1 — Aprire la sezione template

Vai su **Settings** (icona ingranaggio) → **Transactional** → tab **Templates**.

### Passo 2.2 — Creare i 4 template

Per ogni template: clicca **+ New template**, seleziona tipo **Transactional**.

---

#### Template 1: `welcome`

- **Name**: `welcome`
- **Subject**: `Benvenuto su Valuta Facile`
- **Body** (HTML):

```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Benvenuto su Valuta Facile! 🏠</h1>
  <p>Ciao <strong>{{ .Data.nome }}</strong>,</p>
  <p>Il tuo account è stato creato con successo. Ora puoi accedere alla tua area personale per consultare le tue valutazioni e i tuoi report.</p>
  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Valuta Facile — Il portale per la valutazione immobiliare
  </p>
</body>
</html>
```

- → Clicca **Save**
- Nota l'ID assegnato (es. `1`)

---

#### Template 2: `magic-link-video`

- **Name**: `magic-link-video`
- **Subject**: `Accedi al tuo profilo e scarica il report`
- **Body** (HTML):

```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Il tuo report è pronto</h1>
  <p>Ciao <strong>{{ .Data.nome }}</strong>,</p>
  <p>Grazie per aver guardato il video. Il tuo report di valutazione immobiliare è disponibile.</p>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{ .Data.magic_link }}"
       style="background-color: #1a1a1a; color: #ffffff; padding: 14px 28px;
              text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      Accedi e scarica il report
    </a>
  </div>

  <p style="color: #666; font-size: 13px;">
    Questo link è valido per 24 ore. Dopo l'accesso troverai il report nella sezione
    <strong>I tuoi report</strong> del tuo profilo.
  </p>

  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Valuta Facile — Il portale per la valutazione immobiliare
  </p>
</body>
</html>
```

- → Clicca **Save**
- Nota l'ID (es. `2`)

---

#### Template 3: `report-pronto-pagamento`

- **Name**: `report-pronto-pagamento`
- **Subject**: `Il tuo report di valutazione è pronto`
- **Body** (HTML):

```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Pagamento confermato ✓</h1>
  <p>Ciao <strong>{{ .Data.nome }}</strong>,</p>
  <p>Il tuo pagamento è stato elaborato con successo. Il report completo di valutazione immobiliare è ora disponibile nel tuo profilo.</p>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{ .Data.report_url }}"
       style="background-color: #1a1a1a; color: #ffffff; padding: 14px 28px;
              text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      Scarica il report PDF
    </a>
  </div>

  <p style="color: #666; font-size: 13px;">
    Puoi scaricare il report in qualsiasi momento accedendo al tuo profilo su Valuta Facile.
  </p>

  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Valuta Facile — Il portale per la valutazione immobiliare
  </p>
</body>
</html>
```

- → Clicca **Save**
- Nota l'ID (es. `3`)

---

#### Template 4: `visura-pronta`

- **Name**: `visura-pronta`
- **Subject**: `La tua visura è disponibile`
- **Body** (HTML):

```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Visura disponibile</h1>
  <p>Ciao <strong>{{ .Data.nome }}</strong>,</p>
  <p>La visura che hai richiesto è pronta per il download.</p>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{ .Data.download_url }}"
       style="background-color: #1a1a1a; color: #ffffff; padding: 14px 28px;
              text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      Scarica la visura
    </a>
  </div>

  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Valuta Facile — Il portale per la valutazione immobiliare
  </p>
</body>
</html>
```

- → Clicca **Save**
- Nota l'ID (es. `4`)

---

### Passo 2.3 — Aggiornare .env con gli ID template

```env
LISTMONK_TEMPLATE_WELCOME=1
LISTMONK_TEMPLATE_REPORT_PAGAMENTO=3
LISTMONK_TEMPLATE_MAGIC_LINK=2
LISTMONK_TEMPLATE_VISURA_PRONTA=4
```

> Sostituisci con gli ID reali assegnati da listmonk.

---

## PARTE 3 — listmonk: Configurazione SMTP

### Passo 3.1 — Creare account Brevo (se non ce l'hai)

1. Vai su `https://app.brevo.com` → registrati gratis
2. Il piano gratuito include **300 email/giorno** — sufficiente per sviluppo e avvio
3. Vai su **SMTP & API** → **SMTP** → clicca **Generate a new SMTP key**
4. Copia il valore della chiave SMTP (la vedrai solo una volta)

### Passo 3.2 — Configurare SMTP in listmonk

In listmonk vai su **Settings** → tab **SMTP**.

Compila i campi:

| Campo | Valore |
|-------|--------|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Auth protocol | `LOGIN` |
| Username | la tua email Brevo (es. `tuo@email.com`) |
| Password | la chiave SMTP generata al passo 3.1 |
| From address | `noreply@valutafacile.it` (o un tuo dominio verificato) |
| From name | `Valuta Facile` |
| Max connections | `5` |
| Retries | `2` |
| Idle timeout | `60` |

→ Clicca **Save** → poi **Test SMTP** per verificare.

> **Alternativa Resend** (più semplice per sviluppo):
> - Host: `smtp.resend.com` — Port: `587`
> - Username: `resend` — Password: API key da `https://resend.com`
> - From: qualsiasi indirizzo del tuo dominio verificato su Resend

### Passo 3.3 — Riavviare il server

Dopo aver salvato le variabili `.env`, riavvia il server:

```bash
npm run server
```

---

## PARTE 4 — Stripe: Prodotto e Pagamento

### Passo 4.1 — Accedere al pannello Stripe

1. Vai su `https://dashboard.stripe.com`
2. Assicurati di essere in modalità **Test** (switch in alto a destra)

### Passo 4.2 — Creare il prodotto

1. Menu laterale → **Products** → clicca **+ Add product**
2. Compila:
   - **Name**: `Report Valutazione Immobiliare`
   - **Description**: `Report PDF completo con analisi del valore dell'immobile`
   - **Image**: opzionale
3. Nella sezione **Pricing**:
   - Pricing model: **One time**
   - Price: `5.00`
   - Currency: `EUR`
4. → Clicca **Save product**
5. Nella pagina del prodotto appena creato, copia il **Price ID** (formato: `price_xxxxxxxxxxxxxxxxxxxxxxxx`)

### Passo 4.3 — Aggiornare .env con STRIPE_PRICE_ID

```env
STRIPE_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Passo 4.4 — Creare l'endpoint webhook

1. Menu laterale → **Developers** → **Webhooks** → clicca **+ Add endpoint**
2. **Endpoint URL**: `https://il-tuo-dominio.it/api/payment/webhook`
   - In sviluppo locale usa Stripe CLI (vedi sotto)
3. **Events to listen**: seleziona `checkout.session.completed`
4. → Clicca **Add endpoint**
5. Nella pagina dell'endpoint, clicca **Reveal** sotto **Signing secret** → copia il valore

### Passo 4.5 — Aggiornare .env con i segreti Stripe

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxx
```

Le chiavi API si trovano in **Developers** → **API keys**.

### Passo 4.6 — Test webhook in locale con Stripe CLI

Per testare in sviluppo locale senza un dominio pubblico:

```bash
# Installa Stripe CLI (se non l'hai)
# macOS: brew install stripe/stripe-cli/stripe
# Windows: scaricare da https://github.com/stripe/stripe-cli/releases

# Login
stripe login

# Avvia il forwarding (mantieni questo terminale aperto durante i test)
stripe listen --forward-to localhost:4001/api/payment/webhook
```

Il comando mostrerà un `whsec_...` temporaneo — usalo come `STRIPE_WEBHOOK_SECRET` in sviluppo.

---

## PARTE 5 — AdSense Rewarded Ad (opzionale)

> Questa fase è opzionale. Completa le fasi 1-4 prima di procedere.
> AdSense richiede un sito approvato — il processo di approvazione può richiedere giorni.

### Passo 5.1 — Creare l'account AdSense

1. Vai su `https://adsense.google.com` → clicca **Inizia ora**
2. Inserisci l'URL del sito (deve essere raggiungibile pubblicamente)
3. Attendi l'approvazione (da qualche ora a qualche giorno)

### Passo 5.2 — Creare l'ad unit Rewarded

1. Menu laterale → **Annunci** → **Per sito** → seleziona il tuo sito
2. → **Panoramica** → **Rewarded** → clicca **Crea nuova unità annuncio**
3. Configura:
   - **Nome**: `Sblocco Report Valutazione`
   - **Tipo ricompensa**: `Video completato`
4. → Clicca **Crea**
5. Copia il **Publisher ID** (formato: `ca-pub-xxxxxxxxxxxxxxxx`)
6. Copia l'**Ad Unit ID** (formato: `xxxxxxxx`)

### Passo 5.3 — Aggiornare .env

```env
VITE_ADSENSE_PUBLISHER_ID=ca-pub-xxxxxxxxxxxxxxxx
VITE_ADSENSE_AD_UNIT=xxxxxxxx
```

### Passo 5.4 — Aggiornare ReportUnlockModal.tsx

In `src/components/report/ReportUnlockModal.tsx`, aggiorna lo script AdSense con i tuoi ID reali:

```ts
function loadOfferwall(onReward: () => void) {
  const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID
  const adUnit = import.meta.env.VITE_ADSENSE_AD_UNIT
  const script = document.createElement('script')
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`
  script.async = true
  script.crossOrigin = 'anonymous'
  script.onload = () => {
    (window as any).adsbygoogle = (window as any).adsbygoogle || []
    ;(window as any).googletag = (window as any).googletag || { cmd: [] }
    ;(window as any).googletag.cmd.push(() => {
      ;(window as any).googletag.pubads().addEventListener('rewardedSlotGranted', onReward)
    })
  }
  document.head.appendChild(script)
}
```

---

## PARTE 6 — Test End-to-End

### Checklist pre-test

Prima di iniziare i test, verifica:

```
[ ] npm run server → nessun errore in console
[ ] http://localhost:5173 → frontend caricato
[ ] http://localhost:9000 → listmonk raggiungibile
[ ] stripe listen attivo (per test pagamento locale)
[ ] .env aggiornato con tutti gli ID (liste, template, Stripe)
```

---

### Test 1 — Registrazione utente (Better Auth)

1. Vai su `http://localhost:5173`
2. Clicca **Accedi** nell'header
3. Clicca tab **Registrati**
4. Compila: nome, email reale, password
5. Clicca **Crea account**

**Risultato atteso:**
- ✅ Modal si chiude, header mostra nome utente
- ✅ In listmonk → Subscribers: email appare con lista "Tutti gli Utenti"
- ✅ Email "Benvenuto" ricevuta (controlla inbox + spam)

---

### Test 2 — Pagamento €5 (Stripe)

1. Completa una valutazione immobiliare
2. Quando appare la modal, clicca **Ottieni il report completo (€5)**
3. Nella pagina Stripe Checkout, usa carta di test: `4242 4242 4242 4242`, scadenza qualsiasi futura, CVC qualsiasi
4. Clicca **Paga**

**Risultato atteso:**
- ✅ Redirect al frontend con `?session_id=...` nell'URL
- ✅ URL pulito automaticamente, navigazione a `/profilo`
- ✅ Nel terminale Stripe CLI: evento `checkout.session.completed` ricevuto → `[200]`
- ✅ In `uploads/reports/`: file PDF creato
- ✅ In listmonk → Subscribers: email in lista "Clienti Paganti"
- ✅ Email "Report pronto" ricevuta (dalla Fase 7)
- ✅ Nella pagina profilo: report scaricabile

---

### Test 3 — Sblocco report gratuito (video)

1. Completa una valutazione **senza essere loggato**
2. Quando appare la modal, clicca **Guarda un video (gratuito)**
3. Dopo il video, inserisci email nel form
4. Clicca **Ottieni il report**

**Risultato atteso:**
- ✅ Risposta `{ success: true }` dal server (verifica Network tab DevTools)
- ✅ In `uploads/reports/`: file PDF creato
- ✅ Account creato (se email non esisteva): verifica in listmonk → Subscribers
- ✅ Email con magic link ricevuta (dalla Fase 7)

---

### Test 4 — Magic link login

1. Vai su `http://localhost:5173`
2. Clicca **Accedi** → inserisci email → clicca **Invia magic link**
3. Controlla la console del server (in sviluppo, il link viene loggato)
4. Apri il link

**Risultato atteso:**
- ✅ Login automatico, redirect al profilo
- ✅ Header mostra nome utente

---

### Test 5 — Pagina profilo

Da loggato, vai su `/profilo` (o clicca il nome utente nell'header):

```
[ ] Sezione "Le tue valutazioni" mostra le valutazioni passate
[ ] Sezione "I tuoi report" mostra PDF scaricabili
[ ] Clic su download → PDF si apre/scarica
[ ] Modifica nome → nome aggiornato
[ ] Toggle newsletter → nessun errore in console
[ ] Logout → torna alla home, header mostra "Accedi"
```

---

### Test 6 — Eliminazione account

1. Da loggato, vai nelle impostazioni account
2. Clicca **Elimina account**
3. Scrivi `DELETE` nel campo di conferma
4. Conferma

**Risultato atteso:**
- ✅ Logout automatico
- ✅ Redirect alla home
- ✅ Login con le stesse credenziali → errore "utente non trovato"

---

### Comandi utili per debug

```bash
# Log server in tempo reale
npm run server

# Verificare DB SQLite
sqlite3 data/dev.sqlite "SELECT * FROM purchases ORDER BY created_at DESC LIMIT 5;"
sqlite3 data/dev.sqlite "SELECT id, email, name FROM user ORDER BY createdAt DESC LIMIT 10;"

# Verificare PDF generati
ls -la uploads/reports/

# Test email listmonk manuale (curl)
curl -X POST http://localhost:9000/api/tx \
  -u admin:PASSWORD \
  -H "Content-Type: application/json" \
  -d '{
    "subscriber_email": "test@example.com",
    "template_id": 1,
    "data": {"nome": "Mario"}
  }'

# Stripe webhook test manuale
stripe trigger checkout.session.completed
```

---

## Riepilogo variabili .env da compilare

Dopo aver seguito tutti i passi, il tuo `.env` deve avere questi valori compilati:

```env
# Better Auth (generato automaticamente alla Fase 1)
BETTER_AUTH_SECRET=<già compilato>

# listmonk — ID liste
LISTMONK_LIST_TUTTI_UTENTI=___
LISTMONK_LIST_CLIENTI_PAGANTI=___
LISTMONK_LIST_UTENTI_FREE=___
LISTMONK_LIST_NEWSLETTER=___

# listmonk — ID template
LISTMONK_TEMPLATE_WELCOME=___
LISTMONK_TEMPLATE_REPORT_PAGAMENTO=___
LISTMONK_TEMPLATE_MAGIC_LINK=___
LISTMONK_TEMPLATE_VISURA_PRONTA=___

# Stripe
STRIPE_SECRET_KEY=sk_test____
STRIPE_WEBHOOK_SECRET=whsec____
STRIPE_PRICE_ID=price____
VITE_STRIPE_PUBLISHABLE_KEY=pk_test___

# AdSense (opzionale)
VITE_ADSENSE_PUBLISHER_ID=ca-pub-___
VITE_ADSENSE_AD_UNIT=___
```
