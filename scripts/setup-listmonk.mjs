#!/usr/bin/env node
/**
 * setup-listmonk.mjs
 * Crea automaticamente liste e template transazionali su listmonk via API.
 * Idempotente: se una lista/template esiste già, ne riusa l'ID senza duplicare.
 * Aggiorna .env.prod con gli ID ottenuti.
 *
 * Uso:
 *   node scripts/setup-listmonk.mjs [--env .env.prod]
 *
 * Prerequisiti:
 *   - listmonk raggiungibile su http://localhost:9000 (oppure su LISTMONK_URL in env)
 *   - Per dev locale: docker compose --profile run up postgres listmonk -d
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Quale file .env aggiornare (default: .env.prod)
const envArg = process.argv.indexOf('--env')
const ENV_FILE = resolve(ROOT, envArg !== -1 ? process.argv[envArg + 1] : '.env.prod')

// ─── Parser .env minimale ────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  const result = {}
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      result[key] = val
    }
  } catch {
    // file non trovato: usa solo process.env
  }
  return result
}

function updateEnvFile(filePath, updates) {
  let content = ''
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    content = ''
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^(${key}=).*`, 'm')
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`)
    } else {
      content += `\n${key}=${value}`
    }
  }

  writeFileSync(filePath, content, 'utf-8')
}

// ─── Configurazione ───────────────────────────────────────────────────────────

const envVars = { ...parseEnvFile(ENV_FILE), ...process.env }

// In sviluppo locale il container listmonk è su localhost:9000,
// non sull'hostname Docker interno "listmonk:9000"
const RAW_URL = envVars.LISTMONK_URL || 'http://localhost:9000'
const BASE_URL = RAW_URL.includes('listmonk:') ? 'http://localhost:9000' : RAW_URL

const USERNAME = envVars.LISTMONK_USERNAME || envVars.LISTMONK_app__admin_username || 'admin'
const PASSWORD = envVars.LISTMONK_PASSWORD || envVars.LISTMONK_app__admin_password || ''

if (!PASSWORD || PASSWORD === 'CAMBIA_IN_PRODUZIONE') {
  console.error(`
⚠️  ATTENZIONE: LISTMONK_PASSWORD non configurata in ${ENV_FILE}.
   Imposta LISTMONK_PASSWORD prima di eseguire questo script.
   In sviluppo locale usa il valore di LISTMONK_app__admin_password in .env.
`)
  process.exit(1)
}

const AUTH = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${AUTH}`
}

// ─── Helper HTTP ──────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── Liste ────────────────────────────────────────────────────────────────────

const LISTS_TO_CREATE = [
  { name: 'Tutti gli Utenti',  type: 'public',  optin: 'single' },
  { name: 'Clienti Paganti',   type: 'private', optin: 'single' },
  { name: 'Utenti Free',       type: 'private', optin: 'single' },
  { name: 'Newsletter',        type: 'public',  optin: 'double' }
]

async function ensureList(listDef) {
  // Recupera tutte le liste esistenti
  const existing = await api('GET', '/api/lists?per_page=100')
  const found = existing.data?.results?.find(l => l.name === listDef.name)
  if (found) {
    console.log(`  ✓ Lista già esistente: "${listDef.name}" (ID ${found.id})`)
    return found.id
  }
  const created = await api('POST', '/api/lists', listDef)
  console.log(`  + Lista creata: "${listDef.name}" (ID ${created.data.id})`)
  return created.data.id
}

// ─── Template HTML ────────────────────────────────────────────────────────────

const TEMPLATES_TO_CREATE = [
  {
    name: 'welcome',
    subject: 'Benvenuto su Valuta Facile',
    body: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Benvenuto su Valuta Facile! 🏠</h1>
  <p>Ciao <strong>{{ .Tx.Data.nome }}</strong>,</p>
  <p>Il tuo account è stato creato con successo. Ora puoi accedere alla tua area personale per consultare le tue valutazioni e i tuoi report.</p>
  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Valuta Facile — Il portale per la valutazione immobiliare<br>
    <a href="https://www.valutafacile.it" style="color: #666;">www.valutafacile.it</a>
  </p>
</body>
</html>`
  },
  {
    name: 'magic-link-video',
    subject: 'Accedi al tuo profilo e scarica il report',
    body: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Il tuo report è pronto</h1>
  <p>Ciao <strong>{{ .Tx.Data.nome }}</strong>,</p>
  <p>Grazie per aver guardato il video. Il tuo report di valutazione immobiliare è disponibile.</p>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{ .Tx.Data.magic_link }}"
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
    Valuta Facile — Il portale per la valutazione immobiliare<br>
    <a href="https://www.valutafacile.it" style="color: #666;">www.valutafacile.it</a>
  </p>
</body>
</html>`
  },
  {
    name: 'report-pronto-pagamento',
    subject: 'Il tuo report di valutazione è pronto',
    body: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Pagamento confermato ✓</h1>
  <p>Ciao <strong>{{ .Tx.Data.nome }}</strong>,</p>
  <p>Il tuo pagamento è stato elaborato con successo. Il report completo di valutazione immobiliare è ora disponibile nel tuo profilo.</p>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{ .Tx.Data.report_url }}"
       style="background-color: #1a1a1a; color: #ffffff; padding: 14px 28px;
              text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      Scarica il report PDF
    </a>
  </div>

  <p style="color: #666; font-size: 13px;">
    Puoi scaricare il report in qualsiasi momento accedendo al tuo profilo su Valuta Facile.
  </p>

  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Valuta Facile — Il portale per la valutazione immobiliare<br>
    <a href="https://www.valutafacile.it" style="color: #666;">www.valutafacile.it</a>
  </p>
</body>
</html>`
  },
  {
    name: 'visura-pronta',
    subject: 'La tua visura è disponibile',
    body: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Visura disponibile</h1>
  <p>Ciao <strong>{{ .Tx.Data.nome }}</strong>,</p>
  <p>La visura che hai richiesto è pronta per il download.</p>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{ .Tx.Data.download_url }}"
       style="background-color: #1a1a1a; color: #ffffff; padding: 14px 28px;
              text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      Scarica la visura
    </a>
  </div>

  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Valuta Facile — Il portale per la valutazione immobiliare<br>
    <a href="https://www.valutafacile.it" style="color: #666;">www.valutafacile.it</a>
  </p>
</body>
</html>`
  },
  {
    name: 'crea-password',
    subject: 'Il tuo report è pronto — crea la password per accedere',
    body: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Grazie per il tuo acquisto! 🎉</h1>
  <p>Ciao <strong>{{ .Tx.Data.nome }}</strong>,</p>
  <p>Il pagamento è andato a buon fine e il tuo report di valutazione immobiliare è in preparazione.</p>
  <p>Per accedere al tuo profilo personale e scaricare il report, crea prima una password per il tuo account:</p>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{ .Tx.Data.set_password_url }}"
       style="background-color: #1a1a1a; color: #ffffff; padding: 14px 28px;
              text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      Crea la tua password
    </a>
  </div>

  <p style="color: #666; font-size: 13px;">
    Il link è valido per un tempo limitato. Una volta impostata la password potrai accedere
    in qualsiasi momento inserendo questa email e la password scelta.
  </p>

  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Valuta Facile — Il portale per la valutazione immobiliare<br>
    <a href="https://www.valutafacile.it" style="color: #666;">www.valutafacile.it</a>
  </p>
</body>
</html>`
  },
  {
    name: 'reset-password',
    subject: 'Reimposta la tua password — Valuta Facile',
    body: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Reimposta la password</h1>
  <p>Ciao <strong>{{ .Tx.Data.nome }}</strong>,</p>
  <p>Hai richiesto di reimpostare la password del tuo account su Valuta Facile.</p>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{ .Tx.Data.reset_url }}"
       style="background-color: #1a1a1a; color: #ffffff; padding: 14px 28px;
              text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      Crea nuova password
    </a>
  </div>

  <p style="color: #666; font-size: 13px;">
    Il link è valido per <strong>1 ora</strong>.
    Se non hai richiesto il reset, ignora questa email — il tuo account è al sicuro.
  </p>

  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Valuta Facile — Il portale per la valutazione immobiliare<br>
    <a href="https://www.valutafacile.it" style="color: #666;">www.valutafacile.it</a>
  </p>
</body>
</html>`
  }
]

async function ensureTemplate(tmplDef) {
  const existing = await api('GET', '/api/templates')
  const found = existing.data?.find(t => t.name === tmplDef.name)
  if (found) {
    // Aggiorna sempre il body: se lo schema {{ .Tx.Data.X }} cambia in futuro
    // (o se il template esiste già con la sintassi vecchia {{ .Data.X }}),
    // questo garantisce che resti sincronizzato con quanto definito qui.
    await api('PUT', `/api/templates/${found.id}`, {
      name: tmplDef.name,
      subject: tmplDef.subject,
      type: 'tx',
      body: tmplDef.body
    })
    console.log(`  ↻ Template aggiornato: "${tmplDef.name}" (ID ${found.id})`)
    return found.id
  }
  const created = await api('POST', '/api/templates', {
    name: tmplDef.name,
    subject: tmplDef.subject,
    type: 'tx',
    body: tmplDef.body
  })
  console.log(`  + Template creato: "${tmplDef.name}" (ID ${created.data.id})`)
  return created.data.id
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📋 Valuta Facile — Setup listmonk`)
  console.log(`   URL: ${BASE_URL}`)
  console.log(`   Utente: ${USERNAME}`)
  console.log(`   File env: ${ENV_FILE}\n`)

  // Verifica connessione
  try {
    await api('GET', '/api/health')
    console.log('✅ Connessione a listmonk OK\n')
  } catch (err) {
    console.error(`❌ Impossibile raggiungere listmonk su ${BASE_URL}`)
    console.error('   Avvia listmonk prima di eseguire questo script:')
    console.error('   docker compose --profile run up postgres listmonk -d\n')
    process.exit(1)
  }

  // ── 1. Liste ──
  console.log('📁 Creazione liste...')
  const listIds = {}
  for (const listDef of LISTS_TO_CREATE) {
    listIds[listDef.name] = await ensureList(listDef)
  }

  // ── 2. Template ──
  console.log('\n📧 Creazione template transazionali...')
  const templateIds = {}
  for (const tmplDef of TEMPLATES_TO_CREATE) {
    templateIds[tmplDef.name] = await ensureTemplate(tmplDef)
  }

  // ── 3. Aggiorna .env.prod ──
  console.log(`\n📝 Aggiornamento ${ENV_FILE}...`)
  updateEnvFile(ENV_FILE, {
    LISTMONK_LIST_TUTTI_UTENTI:    String(listIds['Tutti gli Utenti']),
    LISTMONK_LIST_CLIENTI_PAGANTI: String(listIds['Clienti Paganti']),
    LISTMONK_LIST_UTENTI_FREE:     String(listIds['Utenti Free']),
    LISTMONK_LIST_NEWSLETTER:      String(listIds['Newsletter']),

    LISTMONK_TEMPLATE_WELCOME:          String(templateIds['welcome']),
    LISTMONK_TEMPLATE_MAGIC_LINK:       String(templateIds['magic-link-video']),
    LISTMONK_TEMPLATE_REPORT_PAGAMENTO: String(templateIds['report-pronto-pagamento']),
    LISTMONK_TEMPLATE_VISURA_PRONTA:    String(templateIds['visura-pronta']),
    LISTMONK_TEMPLATE_RESET_PASSWORD:   String(templateIds['reset-password']),
    LISTMONK_TEMPLATE_CREA_PASSWORD:    String(templateIds['crea-password'])
  })
  console.log('  ✓ ID aggiornati nel file env\n')

  // ── Riepilogo ──
  console.log('═══════════════════════════════════════════════')
  console.log('✅ Setup completato!\n')
  console.log('   LISTE:')
  for (const [name, id] of Object.entries(listIds)) {
    console.log(`     ${id}  →  ${name}`)
  }
  console.log('\n   TEMPLATE:')
  for (const [name, id] of Object.entries(templateIds)) {
    console.log(`     ${id}  →  ${name}`)
  }
  console.log('\n⚠️  Prossimo passo obbligatorio: configurare SMTP in listmonk.')
  console.log('   Vai su http://localhost:9000 → Settings → SMTP')
  console.log('   oppure verifica le variabili SMTP in .env.prod (vedi sotto).')
  console.log('═══════════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('❌ Errore fatale:', err.message)
  process.exit(1)
})
