import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbDir = path.join(__dirname, '..', 'data')

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.join(dbDir, 'dev.sqlite')

const db = new Database(dbPath)

try {
  db.pragma('journal_mode = WAL')
} catch (err) {
  console.error('Errore impostando WAL sul DB principale, fallback DELETE:', err.message)
  try {
    db.pragma('journal_mode = DELETE')
  } catch (err2) {
    console.error('Errore impostando DELETE journal mode sul DB principale:', err2.message)
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    cognome TEXT,
    email TEXT,
    telefono TEXT,
    indirizzo TEXT,
    cap TEXT,
    citta TEXT,
    lat REAL,
    lng REAL,
    step_data TEXT,
    valuation_data TEXT,
    media_meta TEXT,
    ai_analysis_meta TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    email_normalized TEXT,
    ip_address TEXT,
    visitor_id TEXT
  );

  CREATE TABLE IF NOT EXISTS lead_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    mime TEXT,
    size INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES users_leads(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lead_ai_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    summary TEXT,
    extracted_features TEXT,
    delta_price REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES users_leads(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS province_analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_slug TEXT NOT NULL,
    path TEXT NOT NULL,
    event_type TEXT NOT NULL,
    session_id TEXT,
    visitor_id TEXT,
    device_type TEXT,
    traffic_source TEXT,
    user_agent TEXT,
    referer TEXT,
    duration_ms REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    stripe_session_id TEXT UNIQUE,
    lead_id INTEGER,
    report_path TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS report_credits (
    user_id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS processed_stripe_events (
    event_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

// Fase pre-lancio: gate con codici invito. L'admin può creare più codici
// (uno per tester o gruppo di tester), ognuno attivabile/disattivabile
// singolarmente. Ogni volta che qualcuno inserisce un codice valido viene
// creata una riga in invite_sessions con un token univoco: il CODICE resta
// sempre valido e riutilizzabile da persone diverse, ma ogni singolo TOKEN
// generato può essere consumato una sola volta (used_at valorizzato) per
// limitare ogni tester a una sola valutazione.
db.exec(`
  CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    label TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invite_sessions (
    token TEXT PRIMARY KEY,
    code TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    used_at TEXT,
    ip_address TEXT,
    user_agent TEXT
  );

  CREATE TABLE IF NOT EXISTS invite_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT,
    code TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Migrazione una tantum: "CREATE TABLE IF NOT EXISTS" non aggiunge colonne a
// tabelle create in precedenza con uno schema più vecchio (invite_sessions e
// invite_feedback esistevano già, dalla prima versione a codice singolo,
// senza la colonna "code"). La aggiungiamo qui se manca; l'errore "duplicate
// column" viene ignorato perché significa che è già stata aggiunta prima.
for (const [table, column, definition] of [
  ['invite_sessions', 'code', 'TEXT'],
  ['invite_feedback', 'code', 'TEXT'],
  ['invite_sessions', 'evaluations_count', 'INTEGER NOT NULL DEFAULT 0']
]) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  } catch (e) {
    if (!/duplicate column/i.test(e.message)) {
      console.error(`Errore migrazione colonna ${column} su ${table}:`, e.message)
    }
  }
}

// Migrazione una tantum: la prima versione del gate invito usava un solo
// codice condiviso salvato in settings ("invite_code"/"invite_gate_enabled").
// Se esiste ancora e non è già stato migrato, lo importiamo come primo rigo
// della nuova tabella invite_codes, così i codici già creati non si perdono.
try {
  const legacyCode = db.prepare(`SELECT value FROM settings WHERE key = 'invite_code'`).get()?.value
  if (legacyCode && legacyCode.trim()) {
    const already = db.prepare(`SELECT id FROM invite_codes WHERE code = ?`).get(legacyCode.trim())
    if (!already) {
      const legacyEnabled = db.prepare(`SELECT value FROM settings WHERE key = 'invite_gate_enabled'`).get()?.value === 'true'
      db.prepare(
        `INSERT INTO invite_codes (code, label, enabled) VALUES (?, ?, ?)`
      ).run(legacyCode.trim(), null, legacyEnabled ? 1 : 0)
    }
  }
} catch (e) {
  console.error('Errore migrazione codice invito legacy:', e.message)
}

// Cache dei dati di mercato "competitor" (RealAdvisor) per via/zona: evita di
// ri-scrapare ad ogni report generato per lo stesso indirizzo. I dati a monte
// si aggiornano mensilmente, quindi una cache di 1-2 giorni è più che sicura.
db.exec(`
  CREATE TABLE IF NOT EXISTS market_data_cache (
    cache_key TEXT PRIMARY KEY,
    payload TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

// Cache dei punti di interesse (OpenStreetMap/Overpass) per coordinate
// arrotondate: i POI cambiano raramente, quindi una cache lunga (es. 30
// giorni) evita di martellare l'endpoint pubblico di Overpass ad ogni report
// per lo stesso punto/zona.
db.exec(`
  CREATE TABLE IF NOT EXISTS poi_cache (
    cache_key TEXT PRIMARY KEY,
    payload TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

// Conteggio scuole per comune, popolato UNA TANTUM dallo script
// server/scripts/import-scuole.js (dati Scuola in Chiaro/MIUR, statali +
// paritarie). Non viene scritto dall'app in produzione: è una tabella di
// arricchimento del report, aggiornabile ri-lanciando lo script quando si
// vuole un dato più recente (una volta l'anno è più che sufficiente).
db.exec(`
  CREATE TABLE IF NOT EXISTS scuole_comune (
    comune TEXT NOT NULL,
    provincia TEXT,
    infanzia INTEGER NOT NULL DEFAULT 0,
    primaria INTEGER NOT NULL DEFAULT 0,
    secondaria_1_grado INTEGER NOT NULL DEFAULT 0,
    secondaria_2_grado INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (comune)
  )
`)

// Popolazione residente per comune/anno, popolata UNA TANTUM dallo script
// server/scripts/import-demografia.js (bilancio demografico ISTAT,
// demo.istat.it). Permette di calcolare un trend ("popolazione in
// crescita/calo del X% negli ultimi N anni") nel report.
db.exec(`
  CREATE TABLE IF NOT EXISTS popolazione_comune (
    comune TEXT NOT NULL,
    anno INTEGER NOT NULL,
    popolazione INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (comune, anno)
  )
`)

// Migrazione: aggiunge colonne ai DB esistenti (sicuro da re-eseguire)
for (const sql of [
  `ALTER TABLE users_leads ADD COLUMN email_normalized TEXT`,
  `ALTER TABLE users_leads ADD COLUMN ip_address TEXT`,
  `ALTER TABLE users_leads ADD COLUMN visitor_id TEXT`,
  `ALTER TABLE users_leads ADD COLUMN user_id TEXT`,
  // Indirizzo completo "grezzo" (via, cap, città, provincia, lat/lon) così
  // com'è arrivato dal wizard: serve per poter richiedere dati di mercato
  // per via specifica (RealAdvisor) anche molto tempo dopo la creazione del
  // lead, senza dover ricostruire l'indirizzo dalla stringa composta.
  `ALTER TABLE users_leads ADD COLUMN address_json TEXT`,
]) {
  try {
    db.exec(sql)
  } catch (err) {
    if (!err.message.includes('duplicate column name')) throw err
  }
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_leads_email_normalized ON users_leads (email_normalized)`)

export function insertLead({
  contact,
  address,
  property,
  valuation,
  wizardData,
  mediaSummary,
  aiAnalysisSummary,
  emailNormalized,
  ipAddress,
  visitorId,
  userId
}) {
  const stmt = db.prepare(`
    INSERT INTO users_leads (
      nome,
      cognome,
      email,
      telefono,
      indirizzo,
      cap,
      citta,
      lat,
      lng,
      step_data,
      valuation_data,
      media_meta,
      ai_analysis_meta,
      email_normalized,
      ip_address,
      visitor_id,
      user_id,
      address_json
    ) VALUES (@nome, @cognome, @email, @telefono, @indirizzo, @cap, @citta, @lat, @lng, @step_data, @valuation_data, @media_meta, @ai_analysis_meta, @email_normalized, @ip_address, @visitor_id, @user_id, @address_json)
  `)

  const fullAddress =
    address?.display ||
    `${address?.street || ''} ${address?.housenumber || ''}, ${address?.city || ''}, ${address?.state || ''}`.trim()

  const wizardDataWithProperty =
    wizardData || property
      ? {
          ...(wizardData || {}),
          ...(property ? { property } : {})
        }
      : null

  const result = stmt.run({
    nome: contact?.nome || null,
    cognome: contact?.cognome || null,
    email: contact?.email || null,
    telefono: contact?.telefono || null,
    indirizzo: fullAddress,
    cap: address?.postcode || address?.cap || null,
    citta: address?.city || null,
    lat: typeof address?.lat === 'number' ? address.lat : null,
    lng: typeof address?.lon === 'number' ? address.lon : address?.lng ?? null,
    step_data: wizardDataWithProperty
      ? JSON.stringify(wizardDataWithProperty)
      : null,
    valuation_data: valuation ? JSON.stringify(valuation) : null,
    media_meta: mediaSummary ? JSON.stringify(mediaSummary) : null,
    ai_analysis_meta: aiAnalysisSummary ? JSON.stringify(aiAnalysisSummary) : null,
    email_normalized: emailNormalized || null,
    ip_address: ipAddress || null,
    visitor_id: visitorId || null,
    user_id: userId || null,
    address_json: address ? JSON.stringify(address) : null
  })

  return result.lastInsertRowid
}

export function insertMediaRecords(leadId, mediaFiles) {
  if (!Array.isArray(mediaFiles) || !mediaFiles.length) return

  const stmt = db.prepare(`
    INSERT INTO lead_media (
      lead_id,
      type,
      file_url,
      file_name,
      mime,
      size
    ) VALUES (@lead_id, @type, @file_url, @file_name, @mime, @size)
  `)

  const insertMany = db.transaction((files) => {
    for (const f of files) {
      stmt.run({
        lead_id: leadId,
        type: f.type,
        file_url: f.file_url,
        file_name: f.file_name,
        mime: f.mime,
        size: f.size
      })
    }
  })

  insertMany(mediaFiles)
}

export function insertAiAnalysis(leadId, analysis) {
  if (!analysis) return
  const stmt = db.prepare(`
    INSERT INTO lead_ai_analysis (
      lead_id,
      summary,
      extracted_features,
      delta_price
    ) VALUES (@lead_id, @summary, @extracted_features, @delta_price)
  `)

  stmt.run({
    lead_id: leadId,
    summary: analysis.summary ? JSON.stringify(analysis.summary) : null,
    extracted_features: analysis.extracted_features
      ? JSON.stringify(analysis.extracted_features)
      : null,
    delta_price:
      typeof analysis.delta_price === 'number' ? analysis.delta_price : null
  })
}

export function getAdminLeads({ from, to, q, cap, offset, limit }) {
  const where = []
  const params = {}

  if (from) {
    where.push('datetime(created_at) >= datetime(@from)')
    params.from = from
  }
  if (to) {
    where.push('datetime(created_at) <= datetime(@to)')
    params.to = to
  }
  if (cap) {
    where.push('(cap = @cap)')
    params.cap = cap
  }
  if (q) {
    where.push(
      '(lower(nome || " " || cognome || " " || email || " " || telefono || " " || indirizzo || " " || citta || " " || cap) LIKE lower(@q))'
    )
    params.q = `%${q}%`
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const totalStmt = db.prepare(
    `SELECT COUNT(*) as count FROM users_leads ${whereClause}`
  )
  const total = totalStmt.get(params).count

  let rowsQuery = `
    SELECT
      id,
      nome,
      cognome,
      email,
      telefono,
      indirizzo,
      cap,
      citta,
      created_at,
      step_data,
      valuation_data,
      media_meta,
      ai_analysis_meta
    FROM users_leads
    ${whereClause}
    ORDER BY datetime(created_at) DESC
  `

  const boundParams = { ...params }
  if (Number.isFinite(limit) && limit > 0) {
    rowsQuery += '\n    LIMIT @limit OFFSET @offset'
    boundParams.limit = limit
    boundParams.offset = offset
  }

  const rowsStmt = db.prepare(rowsQuery)
  const rows = rowsStmt.all(boundParams)

  const aggStmt = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN datetime(created_at) >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as last7,
      MAX(datetime(created_at)) as last_contact
    FROM users_leads
  `)

  const agg = aggStmt.get()

  const topCapStmt = db.prepare(`
    SELECT cap, COUNT(*) as count
    FROM users_leads
    WHERE cap IS NOT NULL AND cap != ''
    GROUP BY cap
    ORDER BY count DESC
    LIMIT 5
  `)

  const topCap = topCapStmt.all()

  return {
    total,
    items: rows,
    stats: {
      total: agg.total || 0,
      last7: agg.last7 || 0,
      lastContactDate: agg.last_contact,
      topCap
    }
  }
}

export function getLeadById(id) {
  const leadStmt = db.prepare(`
    SELECT *
    FROM users_leads
    WHERE id = ?
  `)
  const lead = leadStmt.get(id)
  if (!lead) return null

  const mediaStmt = db.prepare(`
    SELECT *
    FROM lead_media
    WHERE lead_id = ?
    ORDER BY datetime(created_at) DESC
  `)
  const media = mediaStmt.all(id)

  const aiStmt = db.prepare(`
    SELECT *
    FROM lead_ai_analysis
    WHERE lead_id = ?
    ORDER BY datetime(created_at) DESC
  `)
  const ai = aiStmt.all(id)

  return { lead, media, ai }
}

export function deleteLeadById(id) {
  const stmt = db.prepare(`DELETE FROM users_leads WHERE id = ?`)
  const res = stmt.run(id)
  return res.changes > 0
}

export function deleteAllLeadsAndValuations() {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM lead_media`).run()
    db.prepare(`DELETE FROM lead_ai_analysis`).run()
    db.prepare(`DELETE FROM users_leads`).run()
  })
  tx()
}

export function insertProvinceAnalyticsEvent(event) {
  const stmt = db.prepare(`
    INSERT INTO province_analytics_events (
      province_slug,
      path,
      event_type,
      session_id,
      visitor_id,
      device_type,
      traffic_source,
      user_agent,
      referer,
      duration_ms
    ) VALUES (
      @province_slug,
      @path,
      @event_type,
      @session_id,
      @visitor_id,
      @device_type,
      @traffic_source,
      @user_agent,
      @referer,
      @duration_ms
    )
  `)

  const cleaned = {
    province_slug: event.province_slug,
    path: event.path || '/',
    event_type: event.event_type || 'view',
    session_id: event.session_id || null,
    visitor_id: event.visitor_id || null,
    device_type: event.device_type || null,
    traffic_source: event.traffic_source || null,
    user_agent: event.user_agent
      ? String(event.user_agent).slice(0, 255)
      : null,
    referer: event.referer ? String(event.referer).slice(0, 255) : null,
    duration_ms:
      typeof event.duration_ms === 'number' && event.duration_ms >= 0
        ? event.duration_ms
        : null
  }

  const result = stmt.run(cleaned)
  return result.lastInsertRowid
}

export function getProvinceAnalyticsSummary({ from, to, provinceSlug }) {
  const where = []
  const params = {}

  if (from) {
    where.push('datetime(created_at) >= datetime(@from)')
    params.from = from
  }
  if (to) {
    where.push('datetime(created_at) <= datetime(@to)')
    params.to = to
  }
  if (provinceSlug) {
    where.push('province_slug = @provinceSlug')
    params.provinceSlug = provinceSlug
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const summaryStmt = db.prepare(`
    SELECT
      province_slug,
      COUNT(*) as pageviews,
      COUNT(DISTINCT COALESCE(session_id, '')) as sessions,
      COUNT(DISTINCT COALESCE(visitor_id, '')) as unique_visitors,
      AVG(duration_ms) as avg_duration_ms
    FROM province_analytics_events
    ${whereClause}
    GROUP BY province_slug
    ORDER BY pageviews DESC
  `)

  const rows = summaryStmt.all(params)

  const deviceStmt = db.prepare(`
    SELECT
      province_slug,
      device_type,
      COUNT(*) as count
    FROM province_analytics_events
    ${whereClause}
    GROUP BY province_slug, device_type
  `)

  const deviceRows = deviceStmt.all(params)

  const sourceStmt = db.prepare(`
    SELECT
      province_slug,
      traffic_source,
      COUNT(*) as count
    FROM province_analytics_events
    ${whereClause}
    GROUP BY province_slug, traffic_source
  `)

  const sourceRows = sourceStmt.all(params)

  const devicesByProvince = {}
  deviceRows.forEach(row => {
    const slug = row.province_slug
    if (!devicesByProvince[slug]) {
      devicesByProvince[slug] = []
    }
    devicesByProvince[slug].push({
      device_type: row.device_type || 'unknown',
      count: row.count
    })
  })

  const sourcesByProvince = {}
  sourceRows.forEach(row => {
    const slug = row.province_slug
    if (!sourcesByProvince[slug]) {
      sourcesByProvince[slug] = []
    }
    sourcesByProvince[slug].push({
      traffic_source: row.traffic_source || 'unknown',
      count: row.count
    })
  })

  return rows.map(row => ({
    province_slug: row.province_slug,
    pageviews: row.pageviews,
    sessions: row.sessions,
    unique_visitors: row.unique_visitors,
    avg_duration_ms: row.avg_duration_ms,
    devices: devicesByProvince[row.province_slug] || [],
    sources: sourcesByProvince[row.province_slug] || []
  }))
}

export function getProvinceAnalyticsTimeseries({
  from,
  to,
  provinceSlug,
  granularity
}) {
  const where = []
  const params = {}

  if (from) {
    where.push('datetime(created_at) >= datetime(@from)')
    params.from = from
  }
  if (to) {
    where.push('datetime(created_at) <= datetime(@to)')
    params.to = to
  }
  if (provinceSlug) {
    where.push('province_slug = @provinceSlug')
    params.provinceSlug = provinceSlug
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  let strftimeExpr = "%Y-%m-%d"
  if (granularity === 'month') {
    strftimeExpr = "%Y-%m"
  } else if (granularity === 'week') {
    strftimeExpr = "%Y-%W"
  }

  const stmt = db.prepare(`
    SELECT
      province_slug,
      strftime('${strftimeExpr}', created_at) as bucket,
      COUNT(*) as pageviews,
      COUNT(DISTINCT COALESCE(session_id, '')) as sessions,
      COUNT(DISTINCT COALESCE(visitor_id, '')) as unique_visitors,
      AVG(duration_ms) as avg_duration_ms
    FROM province_analytics_events
    ${whereClause}
    GROUP BY province_slug, bucket
    ORDER BY bucket ASC
  `)

  return stmt.all(params)
}

export function countLeadsByNormalizedEmail(emailNormalized) {
  if (!emailNormalized) return 0
  return db.prepare(`SELECT COUNT(*) as c FROM users_leads WHERE email_normalized = ?`)
    .get(emailNormalized).c
}

export function countLeadsByVisitorId(visitorId) {
  if (!visitorId) return 0
  return db.prepare(`SELECT COUNT(*) as c FROM users_leads WHERE visitor_id = ?`)
    .get(visitorId).c
}

export function getLastContactForUser(userId) {
  if (!userId) return null
  const row = db.prepare(
    `SELECT nome, cognome, telefono FROM users_leads
     WHERE user_id = ? AND (telefono IS NOT NULL AND telefono != '')
     ORDER BY created_at DESC LIMIT 1`
  ).get(userId)
  return row || null
}

export function getLeadsByUserId(userId) {
  return db.prepare(
    `SELECT id, created_at, ip_address, step_data, valuation_data FROM users_leads WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId)
}

export function getPurchasesByUserId(userId) {
  return db.prepare(
    `SELECT id, lead_id, report_path, status, created_at FROM purchases WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId)
}

export function getPurchaseByIdAndUser(id, userId) {
  return db.prepare(`SELECT * FROM purchases WHERE id = ? AND user_id = ?`).get(id, userId)
}

export function createPurchase({ userId, stripeSessionId, leadId, reportPath, status }) {
  return db.prepare(
    `INSERT INTO purchases (user_id, stripe_session_id, lead_id, report_path, status) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, stripeSessionId, leadId, reportPath, status)
}

export function unlinkLeadsByUserId(userId) {
  return db.prepare(`UPDATE users_leads SET user_id = NULL WHERE user_id = ?`).run(userId)
}

// Collega un lead creato in anonimo (prima del login) all'utente che poi si
// autentica per proseguire con l'acquisto. Solo se il lead non è già di qualcun
// altro (WHERE user_id IS NULL), così non si può "rubare" un lead già associato.
export function claimLeadForUser(leadId, userId) {
  const result = db.prepare(
    `UPDATE users_leads SET user_id = ? WHERE id = ? AND user_id IS NULL`
  ).run(userId, leadId)
  return result.changes > 0
}

export function getReportCredits(userId) {
  const row = db.prepare(`SELECT balance FROM report_credits WHERE user_id = ?`).get(userId)
  return row ? row.balance : 0
}

export function addReportCredits(userId, amount) {
  db.prepare(
    `INSERT INTO report_credits (user_id, balance, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = datetime('now')`
  ).run(userId, amount)
  return getReportCredits(userId)
}

export function consumeReportCredit(userId) {
  const result = db.prepare(
    `UPDATE report_credits SET balance = balance - 1, updated_at = datetime('now')
     WHERE user_id = ? AND balance > 0`
  ).run(userId)
  return result.changes > 0
}

// Ritorna true se è la prima volta che vediamo questo evento Stripe (va elaborato),
// false se era già stato registrato in precedenza (retry del webhook, da ignorare).
export function markStripeEventProcessed(eventId) {
  const result = db.prepare(
    `INSERT OR IGNORE INTO processed_stripe_events (event_id) VALUES (?)`
  ).run(eventId)
  return result.changes > 0
}

// --- Cache dati di mercato (RealAdvisor) ---------------------------------

export function getCachedMarketData(cacheKey, maxAgeHours) {
  const row = db
    .prepare(`SELECT payload, success, fetched_at FROM market_data_cache WHERE cache_key = ?`)
    .get(cacheKey)
  if (!row) return null

  const fetchedAtMs = new Date(row.fetched_at + 'Z').getTime()
  const ageHours = (Date.now() - fetchedAtMs) / (1000 * 60 * 60)
  if (!Number.isFinite(ageHours) || ageHours > maxAgeHours) {
    return null
  }

  return {
    success: !!row.success,
    payload: row.payload ? JSON.parse(row.payload) : null,
    fetchedAt: row.fetched_at
  }
}

export function setCachedMarketData(cacheKey, { success, payload }) {
  db.prepare(
    `INSERT INTO market_data_cache (cache_key, payload, success, fetched_at)
     VALUES (@cache_key, @payload, @success, datetime('now'))
     ON CONFLICT(cache_key) DO UPDATE SET
       payload = excluded.payload,
       success = excluded.success,
       fetched_at = excluded.fetched_at`
  ).run({
    cache_key: cacheKey,
    payload: payload ? JSON.stringify(payload) : null,
    success: success ? 1 : 0
  })
}

// --- Cache punti di interesse (OpenStreetMap/Overpass) -------------------

export function getCachedPoi(cacheKey, maxAgeHours) {
  const row = db
    .prepare(`SELECT payload, success, fetched_at FROM poi_cache WHERE cache_key = ?`)
    .get(cacheKey)
  if (!row) return null

  const fetchedAtMs = new Date(row.fetched_at + 'Z').getTime()
  const ageHours = (Date.now() - fetchedAtMs) / (1000 * 60 * 60)
  if (!Number.isFinite(ageHours) || ageHours > maxAgeHours) {
    return null
  }

  return {
    success: !!row.success,
    payload: row.payload ? JSON.parse(row.payload) : null,
    fetchedAt: row.fetched_at
  }
}

export function setCachedPoi(cacheKey, { success, payload }) {
  db.prepare(
    `INSERT INTO poi_cache (cache_key, payload, success, fetched_at)
     VALUES (@cache_key, @payload, @success, datetime('now'))
     ON CONFLICT(cache_key) DO UPDATE SET
       payload = excluded.payload,
       success = excluded.success,
       fetched_at = excluded.fetched_at`
  ).run({
    cache_key: cacheKey,
    payload: payload ? JSON.stringify(payload) : null,
    success: success ? 1 : 0
  })
}

// --- Scuole per comune (dato statico, importato una tantum) --------------

// Normalizza il nome comune per il lookup (maiuscole/minuscole, accenti e
// spazi possono variare tra la fonte MIUR e i dati di geocoding usati altrove
// nell'app, quindi confrontiamo sempre sulla forma "semplificata").
function normalizeComune(nome) {
  return String(nome || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function upsertScuoleComune({ comune, provincia, infanzia, primaria, secondaria1, secondaria2 }) {
  db.prepare(
    `INSERT INTO scuole_comune (comune, provincia, infanzia, primaria, secondaria_1_grado, secondaria_2_grado, updated_at)
     VALUES (@comune, @provincia, @infanzia, @primaria, @secondaria1, @secondaria2, datetime('now'))
     ON CONFLICT(comune) DO UPDATE SET
       provincia = excluded.provincia,
       infanzia = excluded.infanzia,
       primaria = excluded.primaria,
       secondaria_1_grado = excluded.secondaria_1_grado,
       secondaria_2_grado = excluded.secondaria_2_grado,
       updated_at = excluded.updated_at`
  ).run({
    comune: normalizeComune(comune),
    provincia: provincia || null,
    infanzia: infanzia || 0,
    primaria: primaria || 0,
    secondaria1: secondaria1 || 0,
    secondaria2: secondaria2 || 0
  })
}

export function getScuoleForComune(comune) {
  if (!comune) return null
  const row = db
    .prepare(`SELECT * FROM scuole_comune WHERE comune = ?`)
    .get(normalizeComune(comune))
  if (!row) return null
  const totale = row.infanzia + row.primaria + row.secondaria_1_grado + row.secondaria_2_grado
  if (totale === 0) return null
  return {
    comune: row.comune,
    provincia: row.provincia,
    infanzia: row.infanzia,
    primaria: row.primaria,
    secondaria1Grado: row.secondaria_1_grado,
    secondaria2Grado: row.secondaria_2_grado,
    totale
  }
}

// --- Andamento demografico per comune (dato statico, importato una tantum) -

export function upsertPopolazioneComune({ comune, anno, popolazione }) {
  db.prepare(
    `INSERT INTO popolazione_comune (comune, anno, popolazione, updated_at)
     VALUES (@comune, @anno, @popolazione, datetime('now'))
     ON CONFLICT(comune, anno) DO UPDATE SET
       popolazione = excluded.popolazione,
       updated_at = excluded.updated_at`
  ).run({
    comune: normalizeComune(comune),
    anno: Number(anno),
    popolazione: Number(popolazione)
  })
}

// Ritorna la serie storica ordinata per anno e, se ci sono almeno due punti,
// la variazione percentuale dal primo all'ultimo anno disponibile. null se
// lo script di import non è mai stato lanciato per questo comune.
export function getPopolazioneTrendForComune(comune) {
  if (!comune) return null
  const rows = db
    .prepare(`SELECT anno, popolazione FROM popolazione_comune WHERE comune = ? ORDER BY anno ASC`)
    .all(normalizeComune(comune))
  if (!rows.length) return null

  const primo = rows[0]
  const ultimo = rows[rows.length - 1]
  const variazionePct =
    rows.length >= 2 && primo.popolazione > 0
      ? Math.round(((ultimo.popolazione - primo.popolazione) / primo.popolazione) * 1000) / 10
      : null

  return {
    serie: rows,
    annoInizio: primo.anno,
    annoFine: ultimo.anno,
    popolazioneInizio: primo.popolazione,
    popolazioneFine: ultimo.popolazione,
    variazionePct
  }
}

export function getSetting(key, defaultValue = null) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key)
  return row ? row.value : defaultValue
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, String(value))
  return getSetting(key)
}

// ─── Fase pre-lancio: codici invito ────────────────────────────────────────

export function createInviteCode({ code, label }) {
  db.prepare(
    `INSERT INTO invite_codes (code, label, enabled) VALUES (?, ?, 1)`
  ).run(String(code).trim(), label ? String(label).trim() : null)
  return getInviteCodeByText(code)
}

export function listInviteCodes() {
  const codes = db.prepare(`SELECT * FROM invite_codes ORDER BY created_at DESC`).all()
  const sessionStats = db.prepare(
    `SELECT code,
            COUNT(*) AS redemptions,
            SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS completed
     FROM invite_sessions
     WHERE code IS NOT NULL
     GROUP BY code`
  ).all()
  const statsByCode = new Map(sessionStats.map((s) => [s.code, s]))
  return codes.map((c) => {
    const stats = statsByCode.get(c.code)
    return {
      ...c,
      enabled: !!c.enabled,
      redemptions: stats?.redemptions || 0,
      completed: stats?.completed || 0
    }
  })
}

export function getInviteCodeByText(code) {
  if (!code) return null
  const row = db
    .prepare(`SELECT * FROM invite_codes WHERE lower(code) = lower(?)`)
    .get(String(code).trim())
  return row ? { ...row, enabled: !!row.enabled } : null
}

export function updateInviteCode(id, { code, label, enabled }) {
  const existing = db.prepare(`SELECT * FROM invite_codes WHERE id = ?`).get(id)
  if (!existing) return null
  db.prepare(
    `UPDATE invite_codes SET
       code = ?,
       label = ?,
       enabled = ?
     WHERE id = ?`
  ).run(
    code !== undefined ? String(code).trim() : existing.code,
    label !== undefined ? (label ? String(label).trim() : null) : existing.label,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    id
  )
  const updated = db.prepare(`SELECT * FROM invite_codes WHERE id = ?`).get(id)
  return { ...updated, enabled: !!updated.enabled }
}

export function deleteInviteCode(id) {
  db.prepare(`DELETE FROM invite_codes WHERE id = ?`).run(id)
}

export function hasAnyEnabledInviteCode() {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM invite_codes WHERE enabled = 1`).get()
  return row.n > 0
}

// Numero massimo di valutazioni che un singolo token invito può generare.
// Oltre questo limite l'utente può continuare a navigare il sito (il gate
// non lo blocca più), ma non può avviarne di nuove (vedi handlePropertySubmit
// in App.jsx e /api/invite/token-status in server/index.js).
export const INVITE_MAX_EVALUATIONS = 5

export function createInviteSession({ token, code, ipAddress, userAgent }) {
  db.prepare(
    `INSERT INTO invite_sessions (token, code, ip_address, user_agent) VALUES (?, ?, ?, ?)`
  ).run(token, code || null, ipAddress || null, userAgent || null)
  return getInviteSession(token)
}

export function getInviteSession(token) {
  if (!token) return null
  return db.prepare(`SELECT * FROM invite_sessions WHERE token = ?`).get(token) || null
}

// Incrementa il contatore di valutazioni del token, fino al tetto massimo
// INVITE_MAX_EVALUATIONS. Idempotente oltre il tetto: se richiamato quando
// il limite è già raggiunto non incrementa oltre (capita normalmente con
// retry di rete o ricarichi di pagina).
export function consumeInviteSession(token) {
  const session = getInviteSession(token)
  if (!session) return null
  if ((session.evaluations_count || 0) < INVITE_MAX_EVALUATIONS) {
    db.prepare(
      `UPDATE invite_sessions SET used_at = datetime('now'), evaluations_count = COALESCE(evaluations_count, 0) + 1 WHERE token = ?`
    ).run(token)
  }
  return getInviteSession(token)
}

export function getInviteSessionsStats() {
  const total = db.prepare(`SELECT COUNT(*) AS n FROM invite_sessions`).get().n
  const completed = db.prepare(`SELECT COUNT(*) AS n FROM invite_sessions WHERE used_at IS NOT NULL`).get().n
  const totalEvaluations = db.prepare(`SELECT COALESCE(SUM(evaluations_count), 0) AS n FROM invite_sessions`).get().n
  return { totalRedemptions: total, totalCompleted: completed, totalEvaluations }
}

export function insertInviteFeedback({ token, code, message }) {
  db.prepare(
    `INSERT INTO invite_feedback (token, code, message) VALUES (?, ?, ?)`
  ).run(token || null, code || null, message)
}

export function getInviteFeedback(code) {
  if (code) {
    return db
      .prepare(`SELECT * FROM invite_feedback WHERE code = ? ORDER BY created_at DESC`)
      .all(code)
  }
  return db.prepare(`SELECT * FROM invite_feedback ORDER BY created_at DESC`).all()
}

export default db
