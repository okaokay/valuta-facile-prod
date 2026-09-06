// Dati di mercato "arricchiti" presi da RealAdvisor (accordo commerciale in
// essere con il competitor per l'uso dei loro dati aggregati all'interno dei
// nostri report a pagamento — vedi nota interna). Il sito espone pagine
// pubbliche renderizzate lato server con statistiche per via/CAP/comune; qui
// costruiamo l'URL corretto per l'indirizzo dell'utente, scarichiamo la
// pagina e ne estraiamo i dati testuali (niente parsing dipendente da nomi di
// classe CSS, che possono cambiare ad ogni redesign — ci basiamo sulle frasi
// fisse in italiano che compaiono nella pagina, molto più stabili).
//
// Se la struttura del sito cambia e il parsing smette di funzionare, la
// funzione restituisce semplicemente `null` (nessun dato di mercato) e il
// resto del report continua a funzionare regolarmente con i soli dati OMI.

import * as cheerio from 'cheerio'
import {
  getCachedMarketData,
  setCachedMarketData
} from '../db.js'

const BASE_URL = 'https://realadvisor.it/it/mercato-immobiliare'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
// Per candidato (via/CAP/comune, fino a 4 tentativi in sequenza): tenuto
// basso perché in caso di sito irraggiungibile o indirizzo non trovato
// questo tempo si somma per ogni fallback provato, e la generazione del
// report non deve restare bloccata a lungo per questo arricchimento extra.
const FETCH_TIMEOUT_MS = 4000

// Cache: successi per 36h (i dati a monte si aggiornano mensilmente), esiti
// negativi/errori per sole 6h (in modo da ritentare più spesso se il sito ha
// avuto un problema temporaneo, senza però martellarlo ad ogni richiesta).
const CACHE_TTL_SUCCESS_HOURS = 36
const CACHE_TTL_FAILURE_HOURS = 6

// --- Slug -----------------------------------------------------------------

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rimuove accenti (à -> a, ecc.)
    .toLowerCase()
    .replace(/'/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Costruisce le combinazioni di URL da provare, dalla più specifica (via a
// livello di CAP) alla più generica (comune), così se l'indirizzo esatto non
// è nel loro database mostriamo comunque i dati della zona.
function buildCandidateUrls({ cap, comune, via }) {
  const comuneSlug = slugify(comune)
  const viaSlug = via ? slugify(via) : null
  const candidates = []

  if (cap && comuneSlug && viaSlug) {
    candidates.push({
      scope: 'via',
      url: `${BASE_URL}/${cap}-${comuneSlug}/${viaSlug}`
    })
  }
  if (comuneSlug && viaSlug) {
    candidates.push({
      scope: 'via',
      url: `${BASE_URL}/comune-${comuneSlug}-it/${viaSlug}`
    })
  }
  if (cap && comuneSlug) {
    candidates.push({
      scope: 'cap',
      url: `${BASE_URL}/${cap}-${comuneSlug}`
    })
  }
  if (comuneSlug) {
    candidates.push({
      scope: 'comune',
      url: `${BASE_URL}/comune-${comuneSlug}-it`
    })
  }

  return candidates
}

// --- Parsing ----------------------------------------------------------------

function parseItalianInt(str) {
  if (str === undefined || str === null) return null
  const digits = String(str).replace(/[^\d]/g, '')
  if (!digits) return null
  return parseInt(digits, 10)
}

function parseItalianPercent(str) {
  if (str === undefined || str === null) return null
  const cleaned = String(str).replace(',', '.').replace(/[^\d.+-]/g, '')
  const value = parseFloat(cleaned)
  return Number.isFinite(value) ? value : null
}

// Estrae, per una categoria (Case/Appartamenti), il blocco "prezzo mediano di
// vendita / range 80% / prezzo al mq" a partire dal testo della pagina.
function extractSalePriceBlock(text, label) {
  const re = new RegExp(
    `Il prezzo mediano per (?:una|un) ${label} sul mercato è\\s*([\\d.,]+)\\s*€\\.\\s*` +
      `Il prezzo di vendita dell.80% degli immobili varia tra\\s*([\\d.,]+)\\s*€\\s*e\\s*([\\d.,]+)\\s*€\\.\\s*` +
      `Il prezzo medio per m² [^.]*?è\\s*([\\d.,]+)\\s*€\\s*/\\s*m²`,
    'i'
  )
  const match = text.match(re)
  if (!match) return null
  return {
    medianPrice: parseItalianInt(match[1]),
    rangeMin: parseItalianInt(match[2]),
    rangeMax: parseItalianInt(match[3]),
    pricePerSqm: parseItalianInt(match[4])
  }
}

function extractRentPriceBlock(text, label) {
  const re = new RegExp(
    `L.affitto mensile medio per (?:una|un) ${label} è\\s*([\\d.,]+)\\s*€\\.\\s*` +
      `L.affitto dell.80% degli immobili varia tra\\s*([\\d.,]+)\\s*€\\s*e\\s*([\\d.,]+)\\s*€\\.\\s*` +
      `L.affitto annuale medio per m² [^.]*?è\\s*([\\d.,]+)\\s*€\\s*/\\s*m²`,
    'i'
  )
  const match = text.match(re)
  if (!match) return null
  return {
    medianRent: parseItalianInt(match[1]),
    rangeMin: parseItalianInt(match[2]),
    rangeMax: parseItalianInt(match[3]),
    pricePerSqmYear: parseItalianInt(match[4])
  }
}

// Estrae la sezione "Ultime valutazioni vicino a <via>" (carosello di
// immobili valutati di recente in zona: tipo, locali, indirizzo, prezzo/mq,
// data). Non include foto (l'immagine è solo una mappa statica generica, non
// una foto dell'immobile), ma sono valutazioni reali e specifiche della zona.
// Il testo concatenato (via cheerio .text()) non ha spazi tra badge/data e
// tipo immobile (es. "VALUTATO2 lug 2026Appartamento1 stanza..."), quindi il
// pattern qui sotto non assume spazi in quei punti di giunzione.
const PROPERTY_TYPE_WORDS = 'Appartamento|Villa|Casa|Attico|Monolocale|Rustico|Loft|Duplex|Mansarda'

function extractRecentValuations(text, limit = 6) {
  const regex = new RegExp(
    `VALUTATO\\s*(\\d{1,2}\\s+[a-zà-ù]+\\.?\\s+\\d{4})\\s*` +
      `(${PROPERTY_TYPE_WORDS})(\\d+)?\\s*stanz[ae]?\\s*` +
      `([^\\d,]+?),?\\s*(\\d{5})\\s+([A-ZÀ-Ù][a-zà-ù]+)\\D*?` +
      `(\\d[\\d.,]*)\\s*€\\s*/\\s*m`,
    'g'
  )
  const results = []
  let match
  while ((match = regex.exec(text)) && results.length < limit) {
    const [, dataStr, tipo, stanze, indirizzoRaw, cap, comune, prezzoRaw] = match
    const indirizzo = indirizzoRaw.trim().replace(/,$/, '')
    if (!indirizzo) continue
    results.push({
      dataValutazione: dataStr.trim(),
      tipo,
      stanze: stanze ? parseInt(stanze, 10) : null,
      indirizzo,
      cap,
      comune,
      prezzoAlMq: parseItalianInt(prezzoRaw)
    })
  }
  return results
}

// Cerca un <h2>/<h3> il cui testo contiene `headingText`, e ne estrae la
// tabella immediatamente successiva come coppie {label, value}. Robusto a
// cambi di classi CSS: dipende solo dalla struttura heading -> table, non da
// attributi di stile.
function extractTableAfterHeading($, headingText) {
  const heading = $('h1,h2,h3,h4')
    .filter((_, el) => $(el).text().trim().toLowerCase().includes(headingText.toLowerCase()))
    .first()
  if (!heading.length) return []

  const table = heading.nextAll('table').first().length
    ? heading.nextAll('table').first()
    : heading.parent().find('table').first()
  if (!table || !table.length) return []

  const rows = []
  table.find('tbody tr, tr').each((_, tr) => {
    const cells = $(tr)
      .find('td,th')
      .map((__, td) => $(td).text().trim())
      .get()
    if (cells.length >= 2) {
      rows.push({ label: cells[0], value: cells[cells.length - 1] })
    }
  })
  return rows
}

function parseMarketPage(html, { scope, url, addressLabel }) {
  const $ = cheerio.load(html)
  const text = $('body').text().replace(/\s+/g, ' ').trim()

  // Titolo/prezzo principale: "Il prezzo medio degli immobili in X è di
  // **1651 €/m²** a <mese> <anno>."
  const titleMatch = text.match(
    /prezzo medio degli immobili (?:in|a) .*? è di\s*([\d.,]+)\s*€\s*\/\s*m²\s*a\s*([a-zàèéìòù]+ \d{4})/i
  )
  if (!titleMatch) {
    // Pagina non riconosciuta (struttura cambiata, redirect a pagina di
    // errore, indirizzo non trovato senza fallback su zona, ecc.)
    return null
  }

  const pricePerSqm = parseItalianInt(titleMatch[1])
  const referencePeriod = titleMatch[2]

  // Range min-max mostrato subito sotto (es. "1287 € - 2836 €").
  const rangeMatch = text.match(/([\d.,]+)\s*€\s*-\s*([\d.,]+)\s*€/)
  const priceRange = rangeMatch
    ? { min: parseItalianInt(rangeMatch[1]), max: parseItalianInt(rangeMatch[2]) }
    : null

  // Trend a 12 mesi, per case e appartamenti.
  const trend12Match = text.match(
    /Negli ultimi 12 mesi, i prezzi delle case sono (?:aumentati|diminuiti) del\s*([+-]?[\d.,]+)%,\s*mentre i prezzi degli appartamenti sono (?:sali|scesi|aumentat|diminuit)[a-z]* del\s*([+-]?[\d.,]+)%/i
  )

  // Trend a 4 anni, per case e appartamenti.
  const trend4yMatch = text.match(
    /In un periodo di 4 anni, il prezzo al metro quadrato ha registrato un (?:aumento|calo) del\s*([+-]?[\d.,]+)% per le case e un (?:aumento|calo) del\s*([+-]?[\d.,]+)% per gli appartamenti/i
  )

  const trend = {
    case: {
      oneYearPct: trend12Match ? parseItalianPercent(trend12Match[1]) : null,
      fourYearPct: trend4yMatch ? parseItalianPercent(trend4yMatch[1]) : null
    },
    appartamenti: {
      oneYearPct: trend12Match ? parseItalianPercent(trend12Match[2]) : null,
      fourYearPct: trend4yMatch ? parseItalianPercent(trend4yMatch[2]) : null
    }
  }

  const salePrices = {
    case: extractSalePriceBlock(text, 'casa'),
    appartamenti: extractSalePriceBlock(text, 'appartamento')
  }

  const rentPrices = {
    case: extractRentPriceBlock(text, 'casa'),
    appartamenti: extractRentPriceBlock(text, 'appartamento')
  }

  const roomBreakdown = {
    caseVendita: extractTableAfterHeading($, 'Prezzi delle case'),
    appartamentiVendita: extractTableAfterHeading($, 'Prezzi degli appartamenti'),
    caseAffitto: extractTableAfterHeading($, 'Affitto mensile per case'),
    appartamentiAffitto: extractTableAfterHeading($, 'Affitto mensile per appartamenti')
  }

  // Breadcrumb (comune/provincia risolti da RealAdvisor per questo indirizzo).
  const breadcrumbLinks = $('a[href*="/mercato-immobiliare/"]')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)

  const recentValuations = extractRecentValuations(text)

  return {
    scope,
    url,
    addressLabel,
    referencePeriod,
    pricePerSqm,
    priceRange,
    trend,
    salePrices,
    rentPrices,
    roomBreakdown,
    recentValuations,
    breadcrumb: breadcrumbLinks.slice(0, 6),
    fetchedAt: new Date().toISOString()
  }
}

// --- Fetch ------------------------------------------------------------------

async function fetchHtml(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'it-IT,it;q=0.9'
      },
      redirect: 'follow',
      signal: controller.signal
    })
    if (!response.ok) return null
    return await response.text()
  } catch (err) {
    console.warn('⚠️ RealAdvisor: errore fetch', url, err.message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// v2: bump quando cambia la FORMA dei dati estratti (nuovi campi come
// recentValuations), non solo la logica di fetch — altrimenti le voci già in
// cache (fino a 36h) restano silenziosamente prive del nuovo campo, dando
// l'impressione di un bug quando è solo cache non invalidata.
const CACHE_SCHEMA_VERSION = 'v2'

function buildCacheKey({ cap, comune, via }) {
  return [CACHE_SCHEMA_VERSION, slugify(comune) || 'na', cap || 'na', via ? slugify(via) : 'na'].join('|')
}

/**
 * Recupera i dati di mercato (RealAdvisor) per un indirizzo, con fallback
 * automatico via -> CAP -> comune e cache su DB. Non lancia mai eccezioni:
 * in caso di problemi ritorna `null`, così il report può sempre essere
 * generato (solo senza questa sezione aggiuntiva).
 */
export async function getMarketData({ cap, comune, provincia, via } = {}) {
  if (!comune && !cap) return null

  const cacheKey = buildCacheKey({ cap, comune, via })

  const cachedSuccess = getCachedMarketData(cacheKey, CACHE_TTL_SUCCESS_HOURS)
  if (cachedSuccess && cachedSuccess.success) {
    return cachedSuccess.payload
  }
  const cachedFailure = getCachedMarketData(cacheKey, CACHE_TTL_FAILURE_HOURS)
  if (cachedFailure && !cachedFailure.success) {
    return null
  }

  const candidates = buildCandidateUrls({ cap, comune, via })
  const addressLabel = [via, cap && comune ? `${comune} (${cap})` : comune]
    .filter(Boolean)
    .join(', ')

  for (const candidate of candidates) {
    const html = await fetchHtml(candidate.url)
    if (!html) continue

    const parsed = parseMarketPage(html, {
      scope: candidate.scope,
      url: candidate.url,
      addressLabel
    })
    if (parsed) {
      setCachedMarketData(cacheKey, { success: true, payload: parsed })
      return parsed
    }
  }

  setCachedMarketData(cacheKey, { success: false, payload: null })
  return null
}

export const _internal = {
  slugify,
  buildCandidateUrls,
  parseMarketPage,
  extractRecentValuations
}
