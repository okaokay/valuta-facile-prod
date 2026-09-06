import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { randomUUID } from 'crypto'
import { getRealOmiValues } from '../src/services/realOmiService.js'
import { OmiOfficialRepository } from './services/OmiOfficialRepository.js'
import { registerValuationEngine } from './services/valuationEngineRegistry.js'
import { mapUiCategoryToOmi } from './services/omiCategoryMapping.js'
import { searchAddressesServerSide, reverseGeocodeServerSide } from './services/geocodeSearch.js'
import { getMarketData } from './services/realAdvisorMarketData.js'
import { authenticator } from 'otplib'
import {
  insertLead,
  insertMediaRecords,
  insertAiAnalysis,
  getAdminLeads,
  getLeadById,
  deleteLeadById,
  insertProvinceAnalyticsEvent,
  getProvinceAnalyticsSummary,
  getProvinceAnalyticsTimeseries,
  deleteAllLeadsAndValuations,
  getSetting,
  setSetting,
  getLastContactForUser,
  createInviteSession,
  getInviteSession,
  consumeInviteSession,
  getInviteSessionsStats,
  insertInviteFeedback,
  getInviteFeedback,
  createInviteCode,
  listInviteCodes,
  getInviteCodeByText,
  updateInviteCode,
  deleteInviteCode,
  hasAnyEnabledInviteCode,
  INVITE_MAX_EVALUATIONS
} from './db.js'
import { normalizeEmail, isDisposableEmail } from './utils/emailUtils.js'
import { auth } from './auth.ts'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'
import paymentRouter from './routes/payment.ts'
import reportRouter from './routes/report.ts'
import profileRouter from './routes/profile.ts'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.set('trust proxy', 1)
let omiOfficialRepo = null
try {
  omiOfficialRepo = new OmiOfficialRepository()
} catch (e) {
  console.error('Errore inizializzazione OmiOfficialRepository:', e)
}

const PORT = process.env.PORT || 4000
const ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || 'dev-secret-change-in-production'
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET || ''

const ADMIN_ALLOWED_ORIGINS =
  process.env.ADMIN_ALLOWED_ORIGINS ||
  'http://localhost,http://localhost:5173'

const allowedOrigins = ADMIN_ALLOWED_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        if (origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) {
          return callback(null, true)
        }
        return callback(new Error(`Not allowed by CORS: ${origin}`))
      },
      credentials: true
    })(req, res, next)
  }
  return next()
})

// Express 4.21+ ha cambiato il comportamento dei wildcard — uso middleware esplicito
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth/')) {
    return toNodeHandler(auth)(req, res)
  }
  next()
})

// Raw body parser per webhook Stripe — DEVE stare prima di express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())

const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
const reportsDir = path.join(uploadsDir, 'reports')
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir)
  },
  filename(req, file, cb) {
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${unique}_${safeName}`)
  }
})

const upload = multer({ storage })

const valuationMediaStore = new Map()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
})

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
})

function createAdminToken(username) {
  const payload = {
    sub: username,
    role: 'admin',
    scope: ['admin:read', 'admin:write']
  }
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '8h' })
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing token' })
  }
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET)
    req.admin = decoded
    return next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

app.use('/api/payment', paymentRouter)
app.use('/api/report', reportRouter)
app.use('/api/profile', profileRouter)

app.post('/api/admin/login-step1', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {}

  const adminUser = process.env.ADMIN_USER
  const adminPassHash = process.env.ADMIN_PASS_HASH

  if (!adminUser || !adminPassHash) {
    return res.status(500).json({ error: 'Admin credentials not configured' })
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' })
  }

  if (username !== adminUser) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  let passwordOk = false

  try {
    passwordOk = await bcrypt.compare(password, adminPassHash)
  } catch (e) {
    passwordOk = false
  }

  if (!passwordOk) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  if (!ADMIN_TOTP_SECRET) {
    const token = createAdminToken(username)
    return res.json({
      token,
      user: { username },
      totpEnabled: false
    })
  }

  const pendingToken = jwt.sign(
    {
      sub: username,
      stage: 'otp',
      type: 'admin_pending'
    },
    ADMIN_JWT_SECRET,
    { expiresIn: '10m' }
  )

  return res.json({
    pendingToken,
    requireTotp: true
  })
})

app.post('/api/admin/login-step2', loginLimiter, (req, res) => {
  const { pendingToken, otp } = req.body || {}

  const adminUser = process.env.ADMIN_USER

  if (!ADMIN_TOTP_SECRET) {
    return res
      .status(500)
      .json({ error: 'TOTP non configurato sul server (ADMIN_TOTP_SECRET mancante)' })
  }

  if (!pendingToken || !otp) {
    return res.status(400).json({ error: 'Missing data' })
  }

  let payload
  try {
    payload = jwt.verify(pendingToken, ADMIN_JWT_SECRET)
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired pending token' })
  }

  if (!payload || payload.sub !== adminUser || payload.stage !== 'otp') {
    return res.status(401).json({ error: 'Invalid pending token' })
  }

  const isValid = authenticator.verify({
    token: String(otp),
    secret: ADMIN_TOTP_SECRET
  })

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid OTP code' })
  }

  const token = createAdminToken(adminUser)

  return res.json({
    token,
    user: {
      username: adminUser
    }
  })
})

app.post(
  '/api/leads',
  upload.fields([
    { name: 'floorplan', maxCount: 1 },
    { name: 'photos', maxCount: 20 }
  ]),
  async (req, res) => {
    try {
      const { contact, address, property, valuation, wizardData } = req.body

      const parsedContact = contact ? JSON.parse(contact) : null
      const parsedAddress = address ? JSON.parse(address) : null
      const parsedProperty = property ? JSON.parse(property) : null
      let parsedValuation = valuation ? JSON.parse(valuation) : null
      const parsedWizardData = wizardData ? JSON.parse(wizardData) : null

      // Controlli anti-abuso e limite valutazioni
      const rawEmail = parsedContact?.email || null
      const emailNormalized = normalizeEmail(rawEmail)
      const visitorId = req.body.visitor_id || null
      const ipAddress = req.ip || null

      // Risolviamo subito l'utente loggato (se presente): serve sia qui sotto
      // sia più avanti per collegare il lead all'account.
      let earlyUserId = null
      try {
        const earlySession = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
        earlyUserId = earlySession?.user?.id || null
      } catch {}

      if (rawEmail && isDisposableEmail(rawEmail)) {
        return res.status(422).json({
          error: 'disposable_email',
          message: 'Indirizzo email non accettato. Usa un indirizzo email reale.'
        })
      }
      // Nota: il vecchio limite "max 2 valutazioni per email / max 4 per dispositivo"
      // è stato rimosso come blocco duro. Bloccare la CREAZIONE del lead è incompatibile
      // con il flusso a pagamento: un utente (anche anonimo in questo momento, prima di
      // pagare/registrarsi) deve poter sempre salvare la propria valutazione, altrimenti
      // non esiste nessun leadId a cui agganciare il report quando poi acquista. Se in
      // futuro serve un limite anti-abuso, va applicato in modo che non impedisca mai
      // la creazione del lead (es. solo su funzioni extra, non sul salvataggio base).

      if (!parsedValuation && parsedAddress && parsedProperty) {
        try {
          const fallbackValuation = await buildCapBasedValuation(
            parsedAddress,
            parsedProperty,
            {}
          )
          if (fallbackValuation && fallbackValuation.success !== false) {
            parsedValuation = fallbackValuation
          }
        } catch (err) {
          console.error('Errore calcolo valuation server-side in /api/leads:', err)
        }
      }

      // Guardia anti-regressione: se il frontend non manda i dati immobile (o manca la
      // superficie), qualunque valutazione salvata/ricalcolata userà valori di default
      // e produrrà un prezzo plausibile ma SBAGLIATO (bug già capitato: superficie
      // di default invece di quella reale inserita dall'utente). Logghiamo forte per
      // intercettare subito eventuali regressioni lato frontend, senza bloccare il
      // salvataggio del lead (il fallback esiste già più sotto in fase di report).
      if (!parsedProperty || !parsedProperty.livingArea) {
        console.error('⚠️ ATTENZIONE: lead creato SENZA dati immobile validi (property mancante o senza superficie).', {
          email: emailNormalized,
          hasProperty: !!parsedProperty,
          livingArea: parsedProperty?.livingArea,
          hasValuation: !!parsedValuation,
          prezzoMedio: parsedValuation?.prezzoMedio ?? parsedValuation?.valutazione?.prezzoMedio
        })
      }

      const uploadedFiles = []

      const floorplanFiles = req.files?.floorplan || []
      floorplanFiles.forEach((file) => {
        uploadedFiles.push({
          type: 'planimetria',
          file_url: `/uploads/${file.filename}`,
          file_name: file.originalname,
          mime: file.mimetype,
          size: file.size
        })
      })

      const photoFiles = req.files?.photos || []
      photoFiles.forEach((file) => {
        uploadedFiles.push({
          type: 'foto',
          file_url: `/uploads/${file.filename}`,
          file_name: file.originalname,
          mime: file.mimetype,
          size: file.size
        })
      })

      const mediaSummary = {
        hasFloorplan: floorplanFiles.length > 0,
        photosCount: photoFiles.length
      }

      const aiAnalysisSummary = parsedWizardData?.media?.aiFeatures || null

      const userId = earlyUserId

      // Utente loggato che rifà una valutazione: se non manda un telefono
      // (es. dati auto-catturati dall'account, che non include il telefono),
      // recuperiamo quello dell'ultima valutazione salvata dallo stesso utente.
      let finalContact = parsedContact
      if (userId && !parsedContact?.telefono) {
        try {
          const lastContact = getLastContactForUser(userId)
          if (lastContact?.telefono) {
            finalContact = { ...(parsedContact || {}), telefono: lastContact.telefono }
          }
        } catch (err) {
          console.error('Errore recupero ultimo telefono utente:', err)
        }
      }

      const leadId = insertLead({
        contact: finalContact,
        address: parsedAddress,
        property: parsedProperty,
        valuation: parsedValuation,
        wizardData: parsedWizardData,
        mediaSummary,
        aiAnalysisSummary,
        emailNormalized,
        ipAddress,
        visitorId,
        userId
      })

      insertMediaRecords(leadId, uploadedFiles)

      if (aiAnalysisSummary) {
        insertAiAnalysis(leadId, {
          summary: aiAnalysisSummary?.summary || null,
          extracted_features: aiAnalysisSummary?.extracted_features || null,
          delta_price: aiAnalysisSummary?.aiDeltaValue || null
        })
      }

      return res.status(201).json({
        success: true,
        leadId,
        media: mediaSummary
      })
    } catch (e) {
      console.error('Errore creazione lead:', e)
      return res.status(500).json({ error: 'Errore creazione lead' })
    }
  }
)

app.post(
  '/api/analytics/province/pageview',
  analyticsLimiter,
  (req, res) => {
    try {
      const {
        provinceSlug,
        path: eventPath,
        eventType,
        sessionId,
        visitorId,
        deviceType,
        trafficSource,
        userAgent,
        referer,
        durationMs
      } = req.body || {}

      if (!provinceSlug) {
        return res.status(400).json({ error: 'provinceSlug mancante' })
      }

      insertProvinceAnalyticsEvent({
        province_slug: String(provinceSlug).toLowerCase(),
        path: eventPath || '/landing',
        event_type: eventType || 'view',
        session_id: sessionId || null,
        visitor_id: visitorId || null,
        device_type: deviceType || null,
        traffic_source: trafficSource || null,
        user_agent: userAgent || null,
        referer: referer || null,
        duration_ms:
          typeof durationMs === 'number' && durationMs >= 0
            ? durationMs
            : null
      })

      return res.json({ success: true })
    } catch (e) {
      console.error('Errore salvataggio analytics provincia:', e)
      return res.status(500).json({ error: 'Errore salvataggio analytics' })
    }
  }
)

app.post(
  '/api/valuation/media',
  upload.fields([
    { name: 'floorplan', maxCount: 1 },
    { name: 'photos[]', maxCount: 20 }
  ]),
  (req, res) => {
    try {
      const { valuationId } = req.body || {}

      const floorplanFiles = req.files?.['floorplan'] || []
      const photoFiles = req.files?.['photos[]'] || []

      const mediaId = `media_${Date.now()}_${Math.round(Math.random() * 1e9)}`

      valuationMediaStore.set(mediaId, {
        valuationId: valuationId || null,
        floorplanFiles,
        photoFiles
      })

      const uploadedSummary = {
        floorplan: floorplanFiles.length > 0,
        photosCount: photoFiles.length
      }

      return res.json({
        mediaId,
        uploaded: uploadedSummary
      })
    } catch (e) {
      console.error('Errore upload media valutazione:', e)
      return res.status(500).json({ error: 'Upload media non riuscito' })
    }
  }
)

app.post('/api/valuation/ai-analyze', async (req, res) => {
  try {
    const { valuationId, mediaId } = req.body || {}

    if (!mediaId) {
      return res.status(400).json({ error: 'mediaId mancante' })
    }

    const stored = valuationMediaStore.get(mediaId)

    if (!stored) {
      return res.status(404).json({ error: 'Media non trovati per questo mediaId' })
    }

    const { floorplanFiles, photoFiles } = stored
    const hasFloorplan = floorplanFiles.length > 0
    const photosCount = photoFiles.length

    let conditionScore = 0.5

    if (hasFloorplan) {
      conditionScore += 0.12
    } else {
      conditionScore -= 0.04
    }

    const effectivePhotos = Math.min(photosCount, 12)
    conditionScore += effectivePhotos * 0.02

    conditionScore = Math.max(0.3, Math.min(0.9, conditionScore))

    const renovationNeeded = !hasFloorplan && photosCount <= 2

    const tags = []
    if (hasFloorplan) {
      tags.push('planimetria_disponibile')
    } else {
      tags.push('planimetria_mancante')
    }
    if (photosCount === 0) {
      tags.push('nessuna_foto')
    } else if (photosCount < 3) {
      tags.push('poche_foto')
    } else if (photosCount >= 8) {
      tags.push('molte_foto')
    }

    const summaryText = hasFloorplan
      ? 'La presenza di planimetria e un buon numero di foto aumentano la confidenza sulla stima e indicano uno stato complessivamente curato.'
      : 'L’assenza di planimetria e/o di foto riduce la confidenza sulla stima e suggerisce maggior cautela sullo stato reale dell’immobile.'

    const analysis = {
      valuationId: valuationId || null,
      hasFloorplan,
      photosCount,
      conditionScore,
      renovationNeeded,
      summary: {
        description: summaryText
      },
      extracted_features: {
        tags
      }
    }

    return res.json(analysis)
  } catch (e) {
    console.error('Errore analisi AI media:', e)
    return res.status(500).json({ error: 'Analisi AI non riuscita' })
  }
})

// Mappa la condizione scelta nel wizard ("Stato immobile") allo stato di
// conservazione ufficiale OMI (SCADENTE/NORMALE/OTTIMO). "Nuovo" non ha un
// corrispettivo OMI diretto: si ottiene applicando +15% al valore di "Ottimo".
const CONDITION_TO_OMI_STATO = {
  'Da ristrutturare': 'SCADENTE',
  Buono: 'NORMALE',
  Ottimo: 'OTTIMO'
}

// Quando per quel comune/tipologia non esiste una riga OMI per lo stato
// richiesto (SCADENTE e OTTIMO sono pubblicati solo per una minoranza di
// zone), si stima applicando questa percentuale al valore NORMALE, che è
// invece presente per praticamente tutti i comuni italiani.
const CONDITION_FALLBACK_MULTIPLIER = {
  'Da ristrutturare': 0.75, // -25% dal valore Normale
  Ottimo: 1.55 // +55% dal valore Normale
}

const NUOVO_SURCHARGE_MULTIPLIER = 1.15 // Nuovo = valore di Ottimo + 15%

// Il piano incide sempre sulla stima con un incremento (più luce, vista,
// meno rumore stradale ai piani alti), indipendentemente dall'ascensore.
// Attico è il piano più alto in assoluto, con l'incremento maggiore.
const FLOOR_BONUS_MULTIPLIER = {
  0: 0, // Piano Terra
  1: 0, // 1° Piano: nessun incremento
  2: 0.03, // 2° Piano: +3%
  3: 0.05, // 3° Piano: +5%
  4: 0.07, // 4° Piano: +7%
  5: 0.1, // 5° Piano o superiore: +10%
  6: 0.15 // Attico: +15%
}

// Se l'utente NON ha l'ascensore, il bonus piano sopra NON si applica: al suo
// posto si applica un malus netto unico per piano (sostituisce interamente il
// bonus, non si somma/sottrae ad esso), che cresce ad ogni piano e si
// stabilizza al 14% dal 5° piano in su. Anche l'Attico, se senza ascensore,
// prende il malus massimo del 14% (invece del suo bonus normale del +15%).
const NO_ELEVATOR_NET_MALUS_BY_FLOOR = {
  0: 0, // Piano Terra: l'ascensore non serve
  1: 0.05,
  2: 0.08,
  3: 0.1,
  4: 0.12,
  5: 0.14,
  6: 0.14 // Attico senza ascensore: stesso malus massimo del 5°+
}

// Tipologie con terreno/giardino proprio (non condominiale): per queste il
// coefficiente di conversione mq giardino->superficie è più basso (10%
// secondo la prassi di stima, contro il 15% delle abitazioni in condominio),
// perché il giardino pesa proporzionalmente meno su un immobile già più
// grande e con più terreno. Sono anche le uniche tipologie per cui ha senso
// la piscina come caratteristica.
const VILLA_LIKE_PROPERTY_TYPES = ['VILLA', 'VILLETTA A SCHIERA', 'RUSTICO/CASALE']

// Bonus percentuale fisso sul prezzo finale specifico per la categoria
// "Villa" (esclude Villetta a schiera e Rustico/Casale, che pur essendo
// tipologie "con terreno proprio" non godono di questo bonus aggiuntivo).
const VILLA_CATEGORY_BONUS_MULTIPLIER = 0.08

// Stabile/Palazzo: il campo "Piano" indica il numero di piani dell'intero
// edificio (dato informativo), un concetto diverso dalla posizione di un
// singolo appartamento in condominio. Nessun bonus/malus applicato.
const STABILE_PROPERTY_TYPES = ['STABILE/PALAZZO']

// Coefficienti di conversione mq giardino -> superficie di calcolo, secondo
// la prassi di stima immobiliare (coefficienti di merito): oltre i 25 mq il
// giardino pesa progressivamente meno (si usa metà del coefficiente base).
const GARDEN_COEFFICIENT_VILLA_LIKE = 0.1
const GARDEN_COEFFICIENT_APARTMENT_LIKE = 0.15
const GARDEN_AREA_THRESHOLD = 25

// Cantina: coefficiente di conversione mq -> superficie di calcolo, in linea
// con la prassi (20-40% per cantine/soffitte).
const CANTINA_COEFFICIENT = 0.25

// Piscina: non è un valore convertibile in mq, ma un bonus percentuale fisso
// sul prezzo finale (prassi di stima: +5/+10% per piscina di dimensioni
// adeguate e ben mantenuta). Applicabile solo alle tipologie con terreno
// proprio (VILLA_LIKE_PROPERTY_TYPES).
const PISCINA_BONUS_MULTIPLIER = 0.07

// Numero di bagni: bonus percentuale sul prezzo finale in base al numero di
// bagni dichiarato (1 bagno = nessun bonus, poi crescente fino a stabilizzarsi
// al 10% dal 4° bagno in su).
const BATHROOM_BONUS_MULTIPLIER_BY_COUNT = {
  1: 0,
  2: 0.05,
  3: 0.07
}
const BATHROOM_BONUS_MULTIPLIER_MAX = 0.1 // dal 4° bagno in su

function getBathroomBonusMultiplier(bathroomsRaw) {
  const bathrooms = Number(bathroomsRaw)
  if (!Number.isFinite(bathrooms) || bathrooms <= 1) return 0
  if (bathrooms >= 4) return BATHROOM_BONUS_MULTIPLIER_MAX
  return BATHROOM_BONUS_MULTIPLIER_BY_COUNT[bathrooms] ?? 0
}

// Classe energetica: bonus percentuale sul prezzo finale, differenziato per
// classe (scala crescente dalla B alla A4). Le classi C-G non hanno né
// bonus né malus. Se l'utente non conosce la classe (valore "NON_SO" dal
// wizard), viene valutata a 0% come le classi C-G, ma va comunque citata nel
// report come classe con scarsa efficienza energetica (non semplicemente
// omessa), per trasparenza verso il potenziale acquirente.
const ENERGY_CLASS_BONUS_MULTIPLIER_BY_CLASS = {
  B: 0.05,
  A: 0.07,
  A1: 0.08,
  A2: 0.09,
  A3: 0.1,
  A4: 0.12
}
const ENERGY_CLASS_UNKNOWN_VALUE = 'NON_SO'

// Epoca di costruzione: bonus/malus percentuale sul prezzo finale in base
// all'anno dichiarato dall'utente (campo libero "Anno di costruzione"),
// secondo scaglioni di prassi (edifici più vecchi tendenzialmente meno
// efficienti/più da manutenere, edifici recenti costruiti con standard
// energetici e antisismici moderni). Vedi ZONA_DI_PREGIO sotto per l'eccezione
// dei centri storici/zone di pregio, dove questo ragionamento non vale.
const CONSTRUCTION_YEAR_BANDS = [
  { maxYear: 1969, multiplier: -0.2 },
  { minYear: 1970, maxYear: 1999, multiplier: -0.18 },
  { minYear: 2000, maxYear: 2004, multiplier: 0.05 },
  { minYear: 2005, maxYear: 2014, multiplier: 0.15 },
  { minYear: 2015, maxYear: 2019, multiplier: 0.18 },
  { minYear: 2020, multiplier: 0.3 }
]

function getConstructionYearMultiplier(yearBuiltRaw) {
  if (!yearBuiltRaw) return { year: null, multiplier: 0 }
  // Il campo è testo libero ("1985", "circa 1990", "anni '60"...): estraiamo
  // il primo numero a 4 cifre plausibile come anno.
  const match = String(yearBuiltRaw).match(/(1[89]\d{2}|20\d{2})/)
  if (!match) return { year: null, multiplier: 0 }
  const year = Number(match[1])
  const band = CONSTRUCTION_YEAR_BANDS.find(
    (b) =>
      (b.minYear === undefined || year >= b.minYear) &&
      (b.maxYear === undefined || year <= b.maxYear)
  )
  return { year, multiplier: band ? band.multiplier : 0 }
}

// Zona di pregio (es. centro storico di una grande città): la prassi di
// stima e la stessa definizione OMI di "immobile di particolare pregio"
// (valore di zona superiore al +70% della media comunale) riconoscono che in
// queste aree l'età dell'edificio, lo stato di conservazione originario e
// l'assenza di ascensore NON deprimono il valore come altrove — anzi, il
// carattere d'epoca è spesso proprio ciò che rende l'immobile pregiato.
// Attivabile manualmente dal wizard (non abbiamo ancora un aggancio
// automatico indirizzo -> singola zona OMI, vedi nota in
// OmiOfficialRepository). Quando attiva: tutti i malus vengono annullati, ma
// il bonus complessivo risultante viene comunque limitato a questo tetto
// massimo, per evitare stime irrealisticamente alte sommando troppi bonus.
const ZONA_DI_PREGIO_MAX_BONUS_MULTIPLIER = 0.25

// Mansarda: la superficie con altezza sotto 1,5m è dichiarata dall'utente
// come percentuale del totale e viene conteggiata solo al 20% (convenzione
// catastale semplificata) ai fini del calcolo del prezzo.
const MANSARDA_LOW_CEILING_COUNT_RATIO = 0.2

// Loft/Open space: l'altezza dei soffitti è la caratteristica distintiva
// (spaziosità, luce) — un bonus fisso per ogni metro oltre l'altezza
// standard delle abitazioni italiane (2,70m), con un tetto massimo.
const LOFT_CEILING_HEIGHT_STANDARD = 2.7 // metri
const LOFT_CEILING_HEIGHT_BONUS_PER_METER = 0.05 // +5% per metro oltre lo standard
const LOFT_CEILING_HEIGHT_BONUS_MAX = 0.1 // tetto massimo +10%

// Risolve il comune ufficiale OMI a partire da un CAP, disambiguando tra più
// comuni con lo stesso CAP tramite città/provincia se fornite. Usata sia per
// l'indirizzo principale che per l'indirizzo (eventualmente diverso) del
// garage/posto auto.
function resolveComuneForCap(capValue, cityHint, provinceHint) {
  if (!capValue || !omiOfficialRepo) {
    return { comune: null, capStatus: null, numComuniForCap: 0 }
  }
  const comuni = omiOfficialRepo.findComuniByCap(capValue)
  const numComuniForCap = comuni ? comuni.length : 0
  if (!comuni || comuni.length === 0) {
    return { comune: null, capStatus: null, numComuniForCap }
  }
  if (comuni.length === 1) {
    return { comune: comuni[0], capStatus: 'OFFICIAL_COMUNE_ONLY', numComuniForCap }
  }
  const normalizeName = (value) => String(value || '').trim().toLowerCase()
  const normalizedCity = normalizeName(cityHint)
  const normalizedProvince = normalizeName(provinceHint)
  const cityMatches = comuni.filter(
    (c) => normalizeName(c.denominazione_comune) === normalizedCity
  )
  if (cityMatches.length === 1) {
    return { comune: cityMatches[0], capStatus: 'OFFICIAL_COMUNE_ONLY', numComuniForCap }
  }
  if (cityMatches.length > 1 && normalizedProvince) {
    const provinceMatches = cityMatches.filter(
      (c) => normalizeName(c.sigla_provincia) === normalizedProvince
    )
    if (provinceMatches.length === 1) {
      return { comune: provinceMatches[0], capStatus: 'OFFICIAL_COMUNE_ONLY', numComuniForCap }
    }
  }
  return { comune: null, capStatus: 'AMBIGUOUS_CAP', numComuniForCap }
}

async function buildCapBasedValuation(address, property, options = {}) {
  const fallbackMode = options.fallbackMode === 'off' ? 'off' : 'synthetic'
  const cap = (address?.postcode || address?.cap || '').trim()
  const superficie =
    Number(property?.livingArea) ||
    Number(property?.superficie) ||
    80

  const propertyType = property?.propertyType || 'APPARTAMENTO'
  const isVillaLikeType = VILLA_LIKE_PROPERTY_TYPES.includes(
    String(propertyType).trim().toUpperCase()
  )
  const isStabileType = STABILE_PROPERTY_TYPES.includes(
    String(propertyType).trim().toUpperCase()
  )

  // Zona di pregio: dichiarata manualmente dall'agente/utente nel wizard.
  // Annulla tutti i malus (età, stato scadente, no ascensore, mansarda
  // soffitto basso) e limita il bonus complessivo a un tetto massimo — vedi
  // ZONA_DI_PREGIO_MAX_BONUS_MULTIPLIER sopra.
  const zonaDiPregio = !!property?.zonaDiPregio

  // Terrazzo/balcone, giardino e cantina non contano come superficie piena:
  // si aggiunge una quota percentuale dei loro mq alla superficie usata per
  // il calcolo del prezzo totale (superficie "commerciale" ai fini
  // valutazione), secondo i coefficienti di merito di prassi.
  const hasBalconyOrTerrace = !!property?.hasBalconyOrTerrace
  const terraceArea = Number(property?.terraceArea) || 0
  const hasGarden = !!property?.hasGarden
  const gardenArea = Number(property?.gardenArea) || 0
  const hasCantina = !!property?.hasCantina
  const cantinaArea = Number(property?.cantinaArea) || 0

  const terraceAreaBonus = hasBalconyOrTerrace ? terraceArea * 0.3 : 0

  // Giardino: coefficiente diverso per tipologie con terreno proprio (10%)
  // rispetto alle abitazioni in condominio (15%); oltre i 25 mq il
  // coefficiente si dimezza (rendimento decrescente per giardini molto grandi).
  const gardenCoefficient = isVillaLikeType
    ? GARDEN_COEFFICIENT_VILLA_LIKE
    : GARDEN_COEFFICIENT_APARTMENT_LIKE
  const gardenAreaBonus = hasGarden
    ? gardenArea <= GARDEN_AREA_THRESHOLD
      ? gardenArea * gardenCoefficient
      : GARDEN_AREA_THRESHOLD * gardenCoefficient +
        (gardenArea - GARDEN_AREA_THRESHOLD) * (gardenCoefficient / 2)
    : 0

  const cantinaAreaBonus = hasCantina ? cantinaArea * CANTINA_COEFFICIENT : 0

  // Mansarda: la quota di superficie con altezza sotto 1,5m (dichiarata come
  // percentuale) conta solo al 20% ai fini del calcolo, come da convenzione
  // catastale semplificata.
  const isMansardaType = String(propertyType).trim().toUpperCase() === 'MANSARDA'
  const mansardaLowCeilingPercent = isMansardaType
    ? Math.min(100, Math.max(0, Number(property?.mansardaLowCeilingPercent) || 0))
    : 0
  const mansardaLowCeilingRatio = mansardaLowCeilingPercent / 100
  // In zona di pregio il malus del soffitto basso viene annullato (si
  // conteggia il 100% della superficie, non solo il 20%).
  const superficieEffettiva =
    isMansardaType && mansardaLowCeilingRatio > 0 && !zonaDiPregio
      ? superficie *
        (1 - mansardaLowCeilingRatio * (1 - MANSARDA_LOW_CEILING_COUNT_RATIO))
      : superficie

  const superficieCalcolo =
    superficieEffettiva + terraceAreaBonus + gardenAreaBonus + cantinaAreaBonus

  // Loft/Open space: bonus fisso in base all'altezza dei soffitti dichiarata
  // (in metri), oltre lo standard delle abitazioni italiane (2,70m).
  const isLoftType = String(propertyType).trim().toUpperCase() === 'LOFT/OPEN SPACE'
  const loftCeilingHeight = isLoftType
    ? Number(property?.loftCeilingHeight) || 0
    : 0
  const loftCeilingHeightBonusMultiplier =
    isLoftType && loftCeilingHeight > LOFT_CEILING_HEIGHT_STANDARD
      ? Math.min(
          LOFT_CEILING_HEIGHT_BONUS_MAX,
          (loftCeilingHeight - LOFT_CEILING_HEIGHT_STANDARD) *
            LOFT_CEILING_HEIGHT_BONUS_PER_METER
        )
      : 0

  // Piscina: bonus percentuale fisso, applicabile solo alle tipologie con
  // terreno proprio (Villa, Villetta a schiera, Rustico/Casale).
  const hasPiscina = !!property?.hasPiscina && isVillaLikeType
  const piscinaBonusMultiplier = hasPiscina ? PISCINA_BONUS_MULTIPLIER : 0

  // Categoria "Villa": bonus fisso aggiuntivo (vedi VILLA_CATEGORY_BONUS_MULTIPLIER sopra).
  const isVillaCategory = String(propertyType).trim().toUpperCase() === 'VILLA'
  const villaCategoryBonusMultiplier = isVillaCategory ? VILLA_CATEGORY_BONUS_MULTIPLIER : 0

  // Numero di bagni: vedi BATHROOM_BONUS_MULTIPLIER_BY_COUNT sopra.
  const bathroomsCount = Number(property?.bathrooms) || 1
  const bathroomBonusMultiplier = getBathroomBonusMultiplier(bathroomsCount)

  // Classe energetica: bonus differenziato sul prezzo finale, scala crescente
  // B (+5%) -> A (+7%) -> A1 (+8%) -> A2 (+9%) -> A3 (+10%) -> A4 (+12%).
  const energyClass = String(property?.energyClass || '').trim().toUpperCase()
  const energyClassBonusMultiplier = ENERGY_CLASS_BONUS_MULTIPLIER_BY_CLASS[energyClass] || 0
  const hasEnergyClassBonus = energyClassBonusMultiplier > 0

  // Piano e ascensore: incremento sempre applicato in base al piano, più
  // un'eventuale penalità se non c'è l'ascensore (vedi mappe sopra). Per le
  // tipologie con terreno proprio (Villa/Villetta/Rustico) il campo "Piano"
  // indica invece il numero di livelli della villa stessa (es. "due_livelli"),
  // e per Stabile/Palazzo indica il numero di piani dell'intero edificio
  // (es. "tre_piani") — entrambi concetti diversi dalla posizione in un
  // condominio: per queste tipologie non si applica nessun bonus/malus piano
  // né la penalità ascensore (dato puramente informativo). Mansarda non
  // chiede più un piano nel wizard (non è un dato significativo per questa
  // tipologia): nessun bonus/malus piano/ascensore neanche per lei.
  const floorRaw = property?.floor
  const floorValue = isVillaLikeType || isStabileType || isMansardaType
    ? null
    : floorRaw !== undefined && floorRaw !== null && floorRaw !== '' && !Number.isNaN(Number(floorRaw))
      ? Number(floorRaw)
      : null
  // "Attico" può essere scelto sia come tipologia immobile (card) sia come
  // piano (dropdown "Stato immobile" > "Piano"). Il wizard non chiede più un
  // piano per la tipologia Attico (è per definizione sempre l'ultimo piano):
  // usiamo sempre il piano 6 (Attico) come piano "effettivo" per questa
  // tipologia, senza dipendere da alcun valore inviato dal frontend.
  const isAtticoType =
    String(property?.propertyType || '').trim().toUpperCase() === 'ATTICO'
  const effectiveFloorForBonus = isAtticoType ? 6 : floorValue
  const hasElevator = !!property?.hasElevator
  // Con ascensore (o in zona di pregio, dove il malus assenza-ascensore viene
  // sempre annullato) si applica il normale bonus piano. Senza ascensore il
  // bonus piano non si applica: al suo posto un malus netto unico per piano
  // (vedi NO_ELEVATOR_NET_MALUS_BY_FLOOR sopra).
  const applyFloorBonus = hasElevator || zonaDiPregio
  const floorBonus =
    effectiveFloorForBonus !== null && applyFloorBonus
      ? FLOOR_BONUS_MULTIPLIER[effectiveFloorForBonus] ?? 0
      : 0
  const floorNoElevatorPenalty =
    effectiveFloorForBonus !== null && !applyFloorBonus
      ? NO_ELEVATOR_NET_MALUS_BY_FLOOR[effectiveFloorForBonus] ?? 0
      : 0
  const floorAdjustmentMultiplier = 1 + floorBonus - floorNoElevatorPenalty

  // Epoca di costruzione: bonus/malus percentuale in base all'anno dichiarato
  // (vedi CONSTRUCTION_YEAR_BANDS sopra). In zona di pregio il malus (anno
  // ante 2000) viene annullato, ma il bonus per gli edifici recenti resta valido.
  const constructionYearInfo = getConstructionYearMultiplier(property?.yearBuilt)
  const constructionYearMultiplier =
    zonaDiPregio && constructionYearInfo.multiplier < 0
      ? 0
      : constructionYearInfo.multiplier

  // Moltiplicatore complessivo sul prezzo finale: piano/ascensore, piscina,
  // altezza soffitti (loft), classe energetica ed epoca di costruzione —
  // nessuno di questi è convertibile in superficie, quindi si applicano tutti
  // qui come fattori percentuali sul prezzo totale. Esposizione,
  // portineria/vigilanza, vista panoramica e aria condizionata sono state
  // rimosse.
  const totalPriceMultiplierBeforeCap =
    floorAdjustmentMultiplier *
    (1 + piscinaBonusMultiplier) *
    (1 + loftCeilingHeightBonusMultiplier) *
    (1 + energyClassBonusMultiplier) *
    (1 + constructionYearMultiplier) *
    (1 + bathroomBonusMultiplier) *
    (1 + villaCategoryBonusMultiplier)

  // Zona di pregio: il bonus complessivo risultante (qualunque combinazione
  // di fattori) non può comunque superare questo tetto massimo — evita stime
  // irrealisticamente alte sommando troppi bonus contemporaneamente.
  const priceMultiplierCappedByZonaDiPregio =
    zonaDiPregio && totalPriceMultiplierBeforeCap > 1 + ZONA_DI_PREGIO_MAX_BONUS_MULTIPLIER
  const totalPriceMultiplier = priceMultiplierCappedByZonaDiPregio
    ? 1 + ZONA_DI_PREGIO_MAX_BONUS_MULTIPLIER
    : totalPriceMultiplierBeforeCap

  // Garage/posto auto: valutazione SEPARATA basata sui valori OMI della
  // tipologia "Box" — non viene aggiunta al prezzo dell'abitazione. Può avere
  // un indirizzo proprio (garageAddress), diverso da quello dell'abitazione.
  const hasGarage = !!property?.hasGarage
  const garageArea = Number(property?.garageArea) || 0
  const garageAddressRaw = property?.garageAddress || null
  const garageCap = (
    garageAddressRaw?.postcode ||
    garageAddressRaw?.cap ||
    ''
  ).toString().trim()
  let valutazioneGarage = null

  let omiData = null
  let prezzoAlMetroQuadro
  let prezzoMedio
  let prezzoMinimo
  let prezzoMassimo
  let numComuniForCap = null
  let capStatus = null
  // Comune/semestre dell'abitazione già risolti: usati come fallback per il
  // garage se non ha un indirizzo proprio.
  let resolvedMainComune = null
  let resolvedMainSemestreCode = null

  const metadati = {
    metodologia: '',
    fonti: [],
    limitazioni: [],
    dataValutazione: new Date().toISOString().split('T')[0]
  }

  if (cap && omiOfficialRepo) {
    try {
      const comuni = omiOfficialRepo.findComuniByCap(cap)
      numComuniForCap = comuni ? comuni.length : 0
      let comune = null
      if (comuni && comuni.length === 1) {
        comune = comuni[0]
        capStatus = 'OFFICIAL_COMUNE_ONLY'
      } else if (comuni && comuni.length > 1) {
        const rawCity = address?.city || address?.comune || ''
        const rawProvince =
          address?.province || address?.provincia || address?.county || ''
        const normalizeName = (value) =>
          String(value || '')
            .trim()
            .toLowerCase()
        const normalizedCity = normalizeName(rawCity)
        const normalizedProvince = normalizeName(rawProvince)
        const cityMatches = comuni.filter(
          (c) => normalizeName(c.denominazione_comune) === normalizedCity
        )
        if (cityMatches.length === 1) {
          comune = cityMatches[0]
          capStatus = 'OFFICIAL_COMUNE_ONLY'
        } else if (cityMatches.length > 1 && normalizedProvince) {
          const provinceMatches = cityMatches.filter(
            (c) => normalizeName(c.sigla_provincia) === normalizedProvince
          )
          if (provinceMatches.length === 1) {
            comune = provinceMatches[0]
            capStatus = 'OFFICIAL_COMUNE_ONLY'
          } else {
            capStatus = 'AMBIGUOUS_CAP'
          }
        } else {
          capStatus = 'AMBIGUOUS_CAP'
        }
      }
      const semestreCode = omiOfficialRepo.getLatestSemesterCode()
      if (comune && semestreCode && capStatus !== 'AMBIGUOUS_CAP') {
        resolvedMainComune = comune
        resolvedMainSemestreCode = semestreCode
        const comuneId = comune.comune_id
        const totalZonesAllTypologies =
          omiOfficialRepo.countZonesByComuneSemestre({
            comuneId,
            semestreCode
          })
        console.log(
          '[OMI ufficiale] buildCapBasedValuation',
          {
            cap,
            comuneId,
            comune: comune.denominazione_comune,
            semestreCode,
            latestSemesterCode: semestreCode,
            queryParams: {
              id_comune: comuneId,
              codice_semestre: semestreCode
            },
            totalZonesAllTypologies
          }
        )
        // La condizione scelta nel wizard ("Stato immobile") determina ORA il
        // prezzo: si cerca la riga OMI con lo stato di conservazione
        // corrispondente (SCADENTE/NORMALE/OTTIMO) aggregata su tutte le zone
        // del comune (non abbiamo un aggancio indirizzo->singola zona OMI,
        // quindi si continua ad aggregare a livello di comune come prima, ma
        // ora filtrando anche per stato). "Nuovo" non esiste in OMI: si
        // ottiene sempre applicando +15% al valore di "Ottimo".
        const condizione = property?.condition || 'Buono'
        const isNuovo = condizione === 'Nuovo'
        // In zona di pregio il malus "Da ristrutturare" (-25%) viene
        // annullato: si valuta come se lo stato fosse Normale, pur
        // mantenendo "condizione" (sopra) invariata per la visualizzazione
        // nel report (il dato dichiarato dall'utente resta corretto).
        const condizioneMalusAnnullato = zonaDiPregio && condizione === 'Da ristrutturare'
        const statoTarget = isNuovo
          ? 'OTTIMO'
          : condizioneMalusAnnullato
            ? 'NORMALE'
            : CONDITION_TO_OMI_STATO[condizione] || 'NORMALE'

        // Range utilizzato anche solo per recuperare tipologia/fonti a scopo
        // di metadati — indipendente dallo stato (i file CSV coprono tutti gli
        // stati insieme).
        const baseRangeForMeta = omiOfficialRepo.getComuneRangeByUiTypology({
          comuneId,
          semestreCode,
          uiTypology: propertyType
        })

        // Il valore NORMALE serve sempre come base per un eventuale fallback
        // (SCADENTE/OTTIMO non sono pubblicati da OMI per tutte le zone).
        const normaleRange =
          statoTarget === 'NORMALE'
            ? null
            : omiOfficialRepo.getComuneRangeByUiTypologyAndStato({
                comuneId,
                semestreCode,
                uiTypology: propertyType,
                stato: 'NORMALE'
              })

        const statoRange = omiOfficialRepo.getComuneRangeByUiTypologyAndStato({
          comuneId,
          semestreCode,
          uiTypology: propertyType,
          stato: statoTarget
        })

        let min = null
        let max = null
        let zoneCountUsed = 0
        let usedFallback = false

        if (statoRange && statoRange.zone_count_used > 0) {
          min = Number(statoRange.min_comune_eur_mq)
          max = Number(statoRange.max_comune_eur_mq)
          zoneCountUsed = statoRange.zone_count_used
        } else if (normaleRange && normaleRange.zone_count_used > 0) {
          const multiplier = condizioneMalusAnnullato
            ? 1
            : CONDITION_FALLBACK_MULTIPLIER[isNuovo ? 'Ottimo' : condizione] || 1
          const normaleAvg =
            (Number(normaleRange.min_comune_eur_mq) +
              Number(normaleRange.max_comune_eur_mq)) /
            2
          min = max = normaleAvg * multiplier
          zoneCountUsed = normaleRange.zone_count_used
          usedFallback = true
        }

        // "Nuovo" = valore di "Ottimo" (reale o da fallback) + 15%.
        if (isNuovo && typeof min === 'number' && typeof max === 'number') {
          min *= NUOVO_SURCHARGE_MULTIPLIER
          max *= NUOVO_SURCHARGE_MULTIPLIER
        }

        if (typeof min === 'number' && typeof max === 'number' && zoneCountUsed > 0) {
          const avg = (min + max) / 2
          prezzoAlMetroQuadro = Math.round(avg)
          prezzoMedio = Math.round(
            avg * superficieCalcolo * totalPriceMultiplier
          )
          // Su richiesta mostriamo un solo valore preciso: niente più fascia
          // minimo/massimo ampia a livello di comune.
          prezzoMinimo = prezzoMedio
          prezzoMassimo = prezzoMedio
          omiData = {
            min,
            avg,
            max,
            zona: null,
            aggregation_level: 'COMUNE',
            tipologia: baseRangeForMeta
              ? baseRangeForMeta.descr_tipologia
              : statoRange?.descr_tipologia || null,
            condizione,
            statoOmiUsato: usedFallback ? null : statoTarget,
            statoOmiFallback: usedFallback,
            superficieBase: superficie,
            superficieEffettiva,
            superficieCalcolo,
            terraceAreaBonus,
            gardenAreaBonus,
            cantinaAreaBonus,
            mansardaLowCeilingPercent,
            loftCeilingHeight,
            loftCeilingHeightBonusMultiplier,
            piano: floorValue,
            hasElevator,
            floorBonus,
            floorNoElevatorPenalty,
            hasPiscina,
            piscinaBonusMultiplier,
            isVillaCategory,
            villaCategoryBonusMultiplier,
            bathrooms: bathroomsCount,
            bathroomBonusMultiplier,
            energyClass: energyClass || null,
            hasEnergyClassBonus,
            energyClassBonusMultiplier,
            annoCostruzione: constructionYearInfo.year,
            constructionYearMultiplier,
            zonaDiPregio,
            priceMultiplierCappedByZonaDiPregio,
            zonaDiPregioMaxBonusMultiplier: ZONA_DI_PREGIO_MAX_BONUS_MULTIPLIER,
            semestre: semestreCode,
            anno: semestreCode.split('_')[0],
            comune: comune.denominazione_comune,
            provincia: comune.sigla_provincia,
            regione: comune.denominazione_regione,
            reliability: 'UFFICIALE_COMUNALE',
            zone_count_used: zoneCountUsed,
            sources: baseRangeForMeta ? baseRangeForMeta.sources : []
          }
          metadati.metodologia =
            (usedFallback
              ? `Valore OMI NORMALE del comune con aggiustamento per condizione "${condizione}" (dato OMI ufficiale non disponibile per questo stato)`
              : `Valore OMI ufficiale del comune per stato "${statoTarget}"${isNuovo ? ' con sovrapprezzo Nuovo (+15%)' : ''}`) +
            (terraceAreaBonus > 0 || gardenAreaBonus > 0 || cantinaAreaBonus > 0
              ? ` + superficie maggiorata di ${Math.round(terraceAreaBonus + gardenAreaBonus + cantinaAreaBonus)} mq (terrazzo/giardino/cantina)`
              : '') +
            (floorBonus > 0
              ? ` + piano ${effectiveFloorForBonus === 6 ? 'Attico' : effectiveFloorForBonus} (+${Math.round(floorBonus * 100)}%)`
              : '') +
            (floorNoElevatorPenalty > 0
              ? ` - assenza ascensore al piano ${effectiveFloorForBonus === 6 ? 'Attico' : effectiveFloorForBonus} (-${Math.round(floorNoElevatorPenalty * 100)}%)`
              : '') +
            (hasPiscina
              ? ` + piscina (+${Math.round(piscinaBonusMultiplier * 100)}%)`
              : '') +
            (isVillaCategory
              ? ` + categoria Villa (+${Math.round(villaCategoryBonusMultiplier * 100)}%)`
              : '') +
            (bathroomBonusMultiplier > 0
              ? ` + ${bathroomsCount} bagni/lavanderia (+${Math.round(bathroomBonusMultiplier * 100)}%)`
              : '') +
            (mansardaLowCeilingPercent > 0 && !zonaDiPregio
              ? ` - ${mansardaLowCeilingPercent}% superficie con soffitto basso (conteggiata al 20%)`
              : '') +
            (loftCeilingHeightBonusMultiplier > 0
              ? ` + altezza soffitti ${loftCeilingHeight}m (+${Math.round(loftCeilingHeightBonusMultiplier * 100)}%)`
              : '') +
            (hasEnergyClassBonus
              ? ` + classe energetica ${energyClass} (+${Math.round(energyClassBonusMultiplier * 100)}%)`
              : '') +
            (energyClass === ENERGY_CLASS_UNKNOWN_VALUE
              ? ' + classe energetica non specificata (valutata come classe con scarsa efficienza energetica, nessun bonus)'
              : '') +
            (constructionYearMultiplier !== 0
              ? ` ${constructionYearMultiplier > 0 ? '+' : '-'} anno di costruzione ${constructionYearInfo.year} (${constructionYearMultiplier > 0 ? '+' : ''}${Math.round(constructionYearMultiplier * 100)}%)`
              : '') +
            (zonaDiPregio
              ? ` + zona di pregio (tutti i malus annullati${priceMultiplierCappedByZonaDiPregio ? `, bonus complessivo limitato al tetto massimo di +${Math.round(ZONA_DI_PREGIO_MAX_BONUS_MULTIPLIER * 100)}%` : ''})`
              : '')
          metadati.fonti =
            baseRangeForMeta && baseRangeForMeta.sources && baseRangeForMeta.sources.length
              ? baseRangeForMeta.sources.map(
                  (s) => `OMI CSV ${s.tipo_file} (${s.path_relativo})`
                )
              : ['Banca dati OMI ufficiale']
        } else {
          metadati.limitazioni.push(
            'Nessun range OMI ufficiale valido per tipologia richiesta'
          )
          metadati.fallbackReason =
            metadati.fallbackReason || 'NO_OFFICIAL_RANGE_FOR_TYPOLOGY'
        }
      }
      if (!omiData && (!comune || !semestreCode)) {
        metadati.limitazioni.push(
          'Comune o semestre OMI non trovato nel DB ufficiale'
        )
        metadati.fallbackReason =
          metadati.fallbackReason || 'COMUNE_OR_SEMESTER_NOT_FOUND'
        if (capStatus === 'AMBIGUOUS_CAP') {
          metadati.limitazioni.push(
            'CAP associato a più comuni (AMBIGUOUS_CAP)'
          )
        }
      } else if (!omiData) {
        metadati.limitazioni.push(
          'Nessun valore OMI ufficiale per tipologia richiesta'
        )
      }
    } catch (e) {
      console.error('Errore lettura DB OMI ufficiale:', e)
      metadati.limitazioni.push(
        'Errore lettura DB OMI ufficiale'
      )
      metadati.fallbackReason =
        metadati.fallbackReason || 'OFFICIAL_DB_READ_ERROR'
    }
  }

  // Valutazione separata del garage/posto auto (OMI tipologia "Box").
  // Indipendente dall'esito della valutazione principale qui sopra: usa
  // l'indirizzo proprio del garage se fornito (può essere diverso da quello
  // dell'abitazione), altrimenti assume la stessa località dell'abitazione.
  if (hasGarage && garageArea > 0 && omiOfficialRepo) {
    try {
      let garageComune = null
      if (garageCap) {
        const resolvedGarage = resolveComuneForCap(
          garageCap,
          garageAddressRaw?.city || garageAddressRaw?.comune,
          garageAddressRaw?.province || garageAddressRaw?.provincia
        )
        garageComune = resolvedGarage.comune
      }
      const usedOwnAddress = !!garageComune
      if (!garageComune) {
        garageComune = resolvedMainComune
      }
      const semestreCodeForGarage =
        resolvedMainSemestreCode || omiOfficialRepo.getLatestSemesterCode()

      if (garageComune && semestreCodeForGarage) {
        const garageRange = omiOfficialRepo.getComuneRangeByUiTypology({
          comuneId: garageComune.comune_id,
          semestreCode: semestreCodeForGarage,
          uiTypology: 'BOX'
        })
        if (garageRange && garageRange.zone_count_used > 0) {
          const garageMin = Number(garageRange.min_comune_eur_mq)
          const garageMax = Number(garageRange.max_comune_eur_mq)
          const garageAvg = (garageMin + garageMax) / 2
          valutazioneGarage = {
            disponibile: true,
            superficie: garageArea,
            prezzoAlMetroQuadro: Math.round(garageAvg),
            prezzoStimato: Math.round(garageAvg * garageArea),
            tipologia: garageRange.descr_tipologia,
            comune: garageComune.denominazione_comune,
            provincia: garageComune.sigla_provincia,
            semestre: semestreCodeForGarage,
            indirizzoProprio: usedOwnAddress,
            zone_count_used: garageRange.zone_count_used,
            sources: garageRange.sources
          }
        } else {
          valutazioneGarage = {
            disponibile: false,
            superficie: garageArea,
            motivo:
              'Nessun valore OMI ufficiale per la tipologia "Box" in questo comune'
          }
        }
      } else {
        valutazioneGarage = {
          disponibile: false,
          superficie: garageArea,
          motivo: 'Comune del garage non determinato'
        }
      }
    } catch (e) {
      console.error('Errore valutazione garage:', e)
      valutazioneGarage = {
        disponibile: false,
        superficie: garageArea,
        motivo: 'Errore nel recupero dei dati OMI per il garage'
      }
    }
  }

  if (!omiData && fallbackMode === 'synthetic') {
    let fallbackOmi = null
    if (cap) {
      try {
        fallbackOmi = await getRealOmiValues(cap)
      } catch (e) {
        fallbackOmi = null
      }
    }
    const basePrice = fallbackOmi?.avg || 2000
    prezzoAlMetroQuadro = Math.round(basePrice)
    prezzoMedio = Math.round(
      prezzoAlMetroQuadro * superficieCalcolo * totalPriceMultiplier
    )
    prezzoMinimo = Math.round(prezzoMedio * 0.85)
    prezzoMassimo = Math.round(prezzoMedio * 1.15)
    if (fallbackOmi) {
      omiData = {
        ...fallbackOmi,
        aggregation_level: fallbackOmi.aggregation_level || 'CAP',
        semestre: null
      }
      metadati.metodologia = 'Calcolo basato su CAP OMI sintetico'
      metadati.fonti = ['Database OMI sintetico interno']
      metadati.fallbackReason =
        metadati.fallbackReason || 'CAP_OMI_SYNTHETIC'
    } else {
      omiData = null
      metadati.metodologia = 'Calcolo generico per emergenza'
      metadati.fonti = ['Fallback interno']
      metadati.fallbackReason =
        metadati.fallbackReason || 'GENERIC_FALLBACK'
    }
  }

  const hasOfficial =
    omiData && omiData.reliability === 'UFFICIALE_COMUNALE'
  const source = hasOfficial
    ? 'omi-ufficiale-comunale'
    : omiData
    ? 'real-omi-cap-fallback'
    : capStatus === 'AMBIGUOUS_CAP'
    ? 'ambiguous-cap'
    : 'official-no-data'
  const tipologiaOmi =
    omiData && omiData.tipologia ? omiData.tipologia : null

  return {
    success: !!omiData,
    timestamp: new Date().toISOString(),
    source,
    valutazione: {
      prezzoMinimo,
      prezzoMassimo,
      prezzoMedio,
      prezzoAlMetroQuadro
    },
    omiData: omiData || null,
    valutazioneGarage,
    address: address || null,
    property: property || null,
    metadati: {
      ...metadati,
      numComuniForCap,
      capStatus,
      source,
      tipologiaOmi
    }
  }
}

// Espone buildCapBasedValuation ai moduli di generazione report (senza import
// circolare — vedi commento in valuationEngineRegistry.js), così se un lead è
// stato salvato con una valutazione mancante o incompleta il report può
// ricalcolarla al volo invece di mostrare un prezzo a 0€.
registerValuationEngine(buildCapBasedValuation)

// Ricerca indirizzi (autocomplete) proxata lato server verso Nominatim e
// Photon — vedi geocodeSearch.js per il motivo (CORS/policy di Nominatim che
// causavano "Network Error" e 400 chiamando le API direttamente dal
// browser).
app.get('/api/geocode/search', async (req, res) => {
  const query = String(req.query.q || '').trim()
  if (query.length < 2) {
    return res.json({ results: [] })
  }
  try {
    const results = await searchAddressesServerSide(query)
    return res.json({ results })
  } catch (e) {
    console.error('[geocode/search] Errore:', e)
    return res.status(500).json({ results: [], error: 'geocode_search_failed' })
  }
})

app.get('/api/geocode/reverse', async (req, res) => {
  const lat = Number(req.query.lat)
  const lon = Number(req.query.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ address: null, error: 'invalid_coordinates' })
  }
  try {
    const address = await reverseGeocodeServerSide(lat, lon)
    return res.json({ address })
  } catch (e) {
    console.error('[geocode/reverse] Errore:', e)
    return res.status(500).json({ address: null, error: 'geocode_reverse_failed' })
  }
})

// Dati di mercato per le pagine città pubbliche (/valutazione-casa-:slug):
// riusa lo stesso servizio/cache già collegato ai report a pagamento
// (server/services/realAdvisorMarketData.js), qui a livello di solo comune
// (nessun cap/via) così basta lo slug della pagina per identificare la città.
app.get('/api/mercato/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase()
  if (!slug) {
    return res.status(400).json({ error: 'missing_slug' })
  }
  try {
    const market = await getMarketData({ comune: slug })
    if (!market) {
      return res.status(404).json({ error: 'not_found' })
    }
    return res.json({ market })
  } catch (e) {
    console.error('[mercato] Errore:', e)
    return res.status(500).json({ error: 'server_error' })
  }
})

app.post('/api/valuation/enhanced-omi', async (req, res) => {
  const { address, property } = req.body || {}

  if (!address || !property) {
    return res
      .status(400)
      .json({ success: false, error: 'address_or_property_missing' })
  }

  const strictEnv = process.env.OFFICIAL_MODE_STRICT === '1'
  const strictQuery =
    req.query &&
    (req.query.officialModeStrict === '1' ||
      req.query.officialModeStrict === 'true' ||
      req.query.official_mode_strict === '1' ||
      req.query.official_mode_strict === 'true')
  const forceOfficial =
    req.query &&
    (req.query.forceOfficial === '1' ||
      req.query.forceOfficial === 'true' ||
      req.query.force_official === '1' ||
      req.query.force_official === 'true')
  const officialModeStrict = strictEnv || strictQuery || forceOfficial

  const fallbackParam =
    req.query && (req.query.fallback || req.query.fallback_mode)
  let fallbackMode = 'synthetic'
  if (officialModeStrict) {
    fallbackMode = 'off'
  } else if (fallbackParam === 'off' || fallbackParam === 'none') {
    fallbackMode = 'off'
  } else if (fallbackParam === 'synthetic') {
    fallbackMode = 'synthetic'
  } else if (process.env.OMI_FALLBACK_MODE === 'off') {
    fallbackMode = 'off'
  }

  const propertyType = property.propertyType || 'APPARTAMENTO'
  const mappedTypology = mapUiCategoryToOmi(propertyType)
  if (officialModeStrict && !mappedTypology) {
    return res.status(422).json({
      success: false,
      error: 'unsupported_property_type',
      message: 'Tipologia immobile non mappabile verso descr_tipologia OMI in modalità strict',
      source: 'official-no-data',
      valutazione: null,
      omiData: null,
      metadati: {
        limitazioni: [
          'Tipologia immobile non mappabile verso descr_tipologia OMI in modalità strict'
        ],
        fallbackReason: 'UNSUPPORTED_PROPERTY_TYPE'
      }
    })
  }

  try {
    const valuation = await buildCapBasedValuation(address, property, {
      fallbackMode,
      strictMode: officialModeStrict
    })

    const hasOfficial =
      valuation.omiData &&
      valuation.omiData.reliability === 'UFFICIALE_COMUNALE'

    if (officialModeStrict && !hasOfficial) {
      const capStatus =
        valuation.metadati && valuation.metadati.capStatus
          ? valuation.metadati.capStatus
          : null
      const isAmbiguous = capStatus === 'AMBIGUOUS_CAP'
      const errorCode = isAmbiguous
        ? 'ambiguous_cap'
        : 'official_no_data'
      const message = isAmbiguous
        ? 'CAP associato a più comuni, nessun fallback in modalità strict'
        : 'Nessun range OMI ufficiale disponibile in modalità strict'
      return res.status(422).json({
        success: false,
        error: errorCode,
        message,
        source: valuation.source,
        valutazione: valuation.valutazione || null,
        omiData: valuation.omiData || null,
        metadati: valuation.metadati || {}
      })
    }

    return res.json(valuation)
  } catch (e) {
    console.error('Errore /api/valuation/enhanced-omi:', e)
    if (officialModeStrict) {
      return res
        .status(500)
        .json({ success: false, error: 'enhanced_omi_exception' })
    }
    try {
      const fallback = await buildCapBasedValuation(address, property, {
        fallbackMode: 'synthetic',
        strictMode: false
      })
      return res.json(fallback)
    } catch (innerError) {
      console.error('Errore fallback /api/valuation/enhanced-omi:', innerError)
      return res
        .status(500)
        .json({ success: false, error: 'enhanced_omi_exception' })
    }
  }
})

app.get('/api/admin/leads', requireAdmin, (req, res) => {
  const { from, to, q, cap, page = 1, limit } = req.query

  const pageNum = Number(page) > 0 ? Number(page) : 1
  const parsedLimit = Number(limit)
  const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null
  const offset = limitNum ? (pageNum - 1) * limitNum : 0

  try {
    const result = getAdminLeads({
      from,
      to,
      q,
      cap,
      offset,
      limit: limitNum
    })

    return res.json({
      ...result,
      page: pageNum,
      limit: limitNum
    })
  } catch (e) {
    console.error('Errore getAdminLeads:', e)
    return res.status(500).json({ error: 'Errore recupero lead' })
  }
})

app.get('/api/admin/analytics/province/summary', requireAdmin, (req, res) => {
  const { from, to, provinceSlug } = req.query

  try {
    const summary = getProvinceAnalyticsSummary({
      from,
      to,
      provinceSlug: provinceSlug ? String(provinceSlug).toLowerCase() : null
    })

    return res.json({
      ok: true,
      items: summary
    })
  } catch (e) {
    console.error('Errore getProvinceAnalyticsSummary:', e)
    return res
      .status(500)
      .json({ error: 'Errore caricamento analytics province' })
  }
})

app.get(
  '/api/admin/analytics/province/timeseries',
  requireAdmin,
  (req, res) => {
    const { from, to, provinceSlug, granularity } = req.query

    const allowedGranularity = ['day', 'week', 'month']
    const safeGranularity = allowedGranularity.includes(granularity)
      ? granularity
      : 'day'

    try {
      const rows = getProvinceAnalyticsTimeseries({
        from,
        to,
        provinceSlug: provinceSlug ? String(provinceSlug).toLowerCase() : null,
        granularity: safeGranularity
      })

      return res.json({
        ok: true,
        granularity: safeGranularity,
        items: rows
      })
    } catch (e) {
      console.error('Errore getProvinceAnalyticsTimeseries:', e)
      return res.status(500).json({
        error: 'Errore caricamento analytics province (timeseries)'
      })
    }
  }
)

app.get('/api/admin/leads/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  try {
    const data = getLeadById(id)
    if (!data) {
      return res.status(404).json({ error: 'Lead non trovato' })
    }
    return res.json(data)
  } catch (e) {
    console.error('Errore getLeadById:', e)
    return res.status(500).json({ error: 'Errore recupero lead' })
  }
})

app.delete('/api/admin/leads/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  try {
    const ok = deleteLeadById(id)
    if (!ok) {
      return res.status(404).json({ error: 'Lead non trovato' })
    }
    return res.json({ success: true })
  } catch (e) {
    console.error('Errore deleteLeadById:', e)
    return res.status(500).json({ error: 'Errore eliminazione lead' })
  }
})

app.post('/api/admin/tools/reset-leads', requireAdmin, (req, res) => {
  try {
    deleteAllLeadsAndValuations()
    return res.json({ success: true })
  } catch (e) {
    console.error('Errore deleteAllLeadsAndValuations:', e)
    return res
      .status(500)
      .json({ error: 'Errore reset lead e valutazioni' })
  }
})

// --- Sistema pubblicità (AdSense) a flag unico ---
// Stati possibili:
//   off            -> nessuna pubblicità (comportamento originale)
//   banner         -> banner Display statici nelle posizioni concordate, nessun blocco
//   demo_rewarded  -> gate video obbligatorio ma con video finto/placeholder (per testare il flusso)
//   live_rewarded  -> gate video obbligatorio con Google Rewarded Ads reali
const AD_MODES = ['off', 'banner', 'demo_rewarded', 'live_rewarded']
const AD_MODE_SETTING_KEY = 'ad_mode'
const DEFAULT_AD_MODE = 'off'

app.get('/api/config', (req, res) => {
  const adMode = getSetting(AD_MODE_SETTING_KEY, DEFAULT_AD_MODE)
  return res.json({
    adMode: AD_MODES.includes(adMode) ? adMode : DEFAULT_AD_MODE,
    adsensePublisherId: process.env.VITE_ADSENSE_PUBLISHER_ID || null,
    adsenseAdUnit: process.env.VITE_ADSENSE_AD_UNIT || null
  })
})

app.get('/api/admin/settings/ad-mode', requireAdmin, (req, res) => {
  const adMode = getSetting(AD_MODE_SETTING_KEY, DEFAULT_AD_MODE)
  return res.json({ adMode: AD_MODES.includes(adMode) ? adMode : DEFAULT_AD_MODE })
})

app.put('/api/admin/settings/ad-mode', requireAdmin, (req, res) => {
  const { adMode } = req.body || {}
  if (!AD_MODES.includes(adMode)) {
    return res.status(400).json({ error: 'Valore ad-mode non valido' })
  }
  try {
    setSetting(AD_MODE_SETTING_KEY, adMode)
    return res.json({ success: true, adMode })
  } catch (e) {
    console.error('Errore salvataggio ad_mode:', e)
    return res.status(500).json({ error: 'Errore salvataggio impostazione' })
  }
})

// ─── Fase pre-lancio: gate con codici invito ────────────────────────────────
// L'admin può creare più codici (uno per tester o gruppo), ognuno
// attivabile/disattivabile singolarmente. Ogni redemption genera un token
// monouso: il codice resta sempre valido e riutilizzabile da persone
// diverse, ma ogni singolo token può essere usato per una sola valutazione
// (vedi consumeInviteSession).

// Interruttore generale, indipendente dai singoli codici: se disattivato, il
// gate è spento per tutti a prescindere da quali codici risultino "attivi"
// nella lista — comodo per spegnere subito l'intera fase di test senza
// dover disattivare un codice alla volta.
const INVITE_MASTER_ENABLED_KEY = 'invite_master_enabled'

function isInviteMasterEnabled() {
  return getSetting(INVITE_MASTER_ENABLED_KEY, 'true') !== 'false'
}

app.get('/api/invite/status', (req, res) => {
  return res.json({ enabled: isInviteMasterEnabled() && hasAnyEnabledInviteCode() })
})

app.get('/api/admin/invite/master', requireAdmin, (req, res) => {
  return res.json({ enabled: isInviteMasterEnabled() })
})

app.put('/api/admin/invite/master', requireAdmin, (req, res) => {
  const { enabled } = req.body || {}
  try {
    setSetting(INVITE_MASTER_ENABLED_KEY, enabled ? 'true' : 'false')
    return res.json({ enabled: isInviteMasterEnabled() })
  } catch (e) {
    console.error('[admin/invite/master] Errore:', e)
    return res.status(500).json({ error: 'save_failed' })
  }
})

app.post('/api/invite/redeem', (req, res) => {
  if (!isInviteMasterEnabled()) {
    return res.status(400).json({ error: 'gate_disabled' })
  }
  const submittedCode = String(req.body?.code || '').trim()
  if (!submittedCode) {
    return res.status(401).json({ error: 'invalid_code' })
  }
  const inviteCode = getInviteCodeByText(submittedCode)
  if (!inviteCode || !inviteCode.enabled) {
    return res.status(401).json({ error: 'invalid_code' })
  }
  try {
    const token = randomUUID()
    createInviteSession({
      token,
      code: inviteCode.code,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || ''
    })
    return res.json({ token })
  } catch (e) {
    console.error('[invite/redeem] Errore:', e)
    return res.status(500).json({ error: 'redeem_failed' })
  }
})

// Usato dal frontend all'avvio per capire se il token salvato in
// localStorage è ancora valido e quante valutazioni gli restano (vedi
// INVITE_MAX_EVALUATIONS): oltre il limite l'utente può continuare a
// navigare il sito, ma non può più avviare nuove valutazioni.
app.get('/api/invite/token-status', (req, res) => {
  const token = String(req.query.token || '')
  const session = getInviteSession(token)
  if (!session) return res.json({ valid: false, remaining: 0, limit: INVITE_MAX_EVALUATIONS })
  const count = session.evaluations_count || 0
  const remaining = Math.max(0, INVITE_MAX_EVALUATIONS - count)
  return res.json({ valid: true, remaining, limit: INVITE_MAX_EVALUATIONS, count })
})

app.post('/api/invite/consume', (req, res) => {
  const token = String(req.body?.token || '')
  const session = consumeInviteSession(token)
  if (!session) return res.status(404).json({ error: 'token_not_found' })
  const count = session.evaluations_count || 0
  const remaining = Math.max(0, INVITE_MAX_EVALUATIONS - count)
  return res.json({ success: true, remaining, limit: INVITE_MAX_EVALUATIONS, count })
})

app.post('/api/invite/feedback', (req, res) => {
  const token = String(req.body?.token || '')
  const message = String(req.body?.message || '').trim()
  if (!message) {
    return res.status(400).json({ error: 'empty_message' })
  }
  try {
    const session = getInviteSession(token)
    insertInviteFeedback({ token, code: session?.code || null, message: message.slice(0, 5000) })
    return res.json({ success: true })
  } catch (e) {
    console.error('[invite/feedback] Errore:', e)
    return res.status(500).json({ error: 'feedback_failed' })
  }
})

app.get('/api/admin/invite/codes', requireAdmin, (req, res) => {
  try {
    return res.json({ codes: listInviteCodes() })
  } catch (e) {
    console.error('[admin/invite/codes] Errore:', e)
    return res.status(500).json({ error: 'fetch_failed' })
  }
})

app.post('/api/admin/invite/codes', requireAdmin, (req, res) => {
  const { code, label } = req.body || {}
  const cleanCode = String(code || '').trim()
  if (!cleanCode) {
    return res.status(400).json({ error: 'empty_code' })
  }
  if (getInviteCodeByText(cleanCode)) {
    return res.status(409).json({ error: 'code_already_exists' })
  }
  try {
    createInviteCode({ code: cleanCode, label })
    return res.json({ codes: listInviteCodes() })
  } catch (e) {
    console.error('[admin/invite/codes] Errore creazione:', e)
    return res.status(500).json({ error: 'create_failed' })
  }
})

app.put('/api/admin/invite/codes/:id', requireAdmin, (req, res) => {
  const { code, label, enabled } = req.body || {}
  try {
    const updated = updateInviteCode(Number(req.params.id), { code, label, enabled })
    if (!updated) return res.status(404).json({ error: 'not_found' })
    return res.json({ codes: listInviteCodes() })
  } catch (e) {
    console.error('[admin/invite/codes] Errore aggiornamento:', e)
    return res.status(500).json({ error: 'update_failed' })
  }
})

app.delete('/api/admin/invite/codes/:id', requireAdmin, (req, res) => {
  try {
    deleteInviteCode(Number(req.params.id))
    return res.json({ codes: listInviteCodes() })
  } catch (e) {
    console.error('[admin/invite/codes] Errore eliminazione:', e)
    return res.status(500).json({ error: 'delete_failed' })
  }
})

app.get('/api/admin/invite/feedback', requireAdmin, (req, res) => {
  try {
    const code = req.query.code ? String(req.query.code) : undefined
    return res.json({ feedback: getInviteFeedback(code) })
  } catch (e) {
    console.error('[admin/invite/feedback] Errore:', e)
    return res.status(500).json({ error: 'fetch_failed' })
  }
})

app.post('/api/ai/valuation', async (req, res) => {
  const { address, propertyData } = req.body || {}

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return res.status(503).json({ error: 'AI service not configured' })
  }

  const city = address?.city || 'Non specificata'
  const fullAddress = address?.display || `${address?.street || ''} ${address?.housenumber || ''}, ${city}`
  const superficie = propertyData?.livingArea || propertyData?.superficie || 80

  const prompt = `VALUTAZIONE IMMOBILIARE

INDIRIZZO: ${fullAddress}
Città: ${city}, CAP: ${address?.postcode || 'N/D'}

CARATTERISTICHE:
- Superficie: ${superficie} mq
- Locali: ${propertyData?.rooms || propertyData?.locali || 'N/D'}
- Bagni: ${propertyData?.bathrooms || propertyData?.bagni || 'N/D'}
- Piano: ${propertyData?.floor || propertyData?.piano || 'N/D'}
- Stato: ${propertyData?.condition || propertyData?.stato || 'N/D'}
- Ascensore: ${propertyData?.hasElevator ? 'Sì' : 'No'}
- Anno costruzione: ${propertyData?.yearBuilt || propertyData?.annoCostruzione || 'N/D'}

Fornisci una valutazione in formato JSON con campi: valutazione (prezzoMinimo, prezzoMassimo, prezzoMedio, prezzoAlMetroQuadro), analisi (puntiForza, puntiDebolezza, motivazione), raccomandazioni (venditore, acquirente), affidabilita (1-10), note.`

  const models = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']

  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'Sei un esperto valutatore immobiliare italiano. Fornisci valutazioni realistiche in formato JSON.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        if (errorText.includes('decommissioned') || errorText.includes('model_decommissioned')) {
          continue
        }
        throw new Error(`Groq API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return res.json({
          success: true,
          source: 'groq-ai',
          valutazione: parsed.valutazione || {},
          analisiAI: {
            puntiForza: parsed.analisi?.puntiForza || [],
            puntiDebolezza: parsed.analisi?.puntiDebolezza || [],
            raccomandazioni: parsed.raccomandazioni || {},
            affidabilita: parsed.affidabilita || 8
          },
          metadati: {
            metodologia: 'Valutazione AI basata su dati di mercato',
            fonti: ['Groq AI'],
            limitazioni: [],
            dataValutazione: new Date().toISOString().split('T')[0]
          },
          note: parsed.note || 'Valutazione basata su analisi AI'
        })
      }
    } catch (err) {
      if (model === models[models.length - 1]) {
        console.error('Errore proxy Groq:', err.message)
      }
    }
  }

  return res.status(503).json({ error: 'AI service temporarily unavailable' })
})

app.use('/api/uploads', express.static(uploadsDir))

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Admin / leads API server in ascolto su http://localhost:${PORT}`)
})
