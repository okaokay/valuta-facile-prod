// Punti di interesse (farmacie, scuole, supermercati, fermate, banche, uffici
// postali) nelle vicinanze di un immobile, presi da OpenStreetMap tramite
// l'API pubblica Overpass — gratuita, senza chiave API, mantenuta dalla
// community OpenStreetMap (overpass-api.de).
//
// Nota sulla copertura dati: OpenStreetMap è più completo nelle città medio-
// grandi; nei comuni piccoli alcune categorie potrebbero risultare vuote
// (non è un errore, semplicemente non risulta nulla mappato entro il raggio
// di ricerca). Per questo la funzione ritorna sempre e solo le categorie che
// hanno effettivamente trovato qualcosa, e `null` se non è stato trovato
// proprio nulla o in caso di errore di rete — il resto del report continua a
// funzionare regolarmente senza questa sezione aggiuntiva.

import { getCachedPoi, setCachedPoi } from '../db.js'

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
// Le query Overpass possono richiedere qualche secondo in più di una normale
// pagina HTML (interrogano un database geografico enorme), quindi il timeout
// qui è più permissivo di quello usato per lo scraping RealAdvisor.
const FETCH_TIMEOUT_MS = 8000
const SEARCH_RADIUS_METERS = 500
// I POI cambiano raramente (una farmacia non si sposta ogni settimana):
// cache lunga per non sovraccaricare l'endpoint pubblico condiviso.
const CACHE_TTL_SUCCESS_HOURS = 24 * 30
const CACHE_TTL_FAILURE_HOURS = 12
const MAX_ITEMS_PER_CATEGORY = 3

// Categorie cercate: etichetta italiana + tag/valore OpenStreetMap. L'ordine
// qui è anche l'ordine con cui compaiono nel report.
const CATEGORIES = [
  { key: 'farmacia', label: 'Farmacia', tag: 'amenity', value: 'pharmacy' },
  { key: 'scuola', label: 'Scuola', tag: 'amenity', value: 'school' },
  { key: 'universita', label: 'Università', tag: 'amenity', value: 'university' },
  { key: 'supermercato', label: 'Supermercato', tag: 'shop', value: 'supermarket' },
  { key: 'fermata', label: 'Fermata trasporto pubblico', tag: 'highway', value: 'bus_stop' },
  { key: 'stazione', label: 'Stazione ferroviaria', tag: 'railway', regex: '^(station|halt)$' },
  { key: 'ospedale', label: 'Ospedale', tag: 'amenity', value: 'hospital' },
  { key: 'banca', label: 'Banca', tag: 'amenity', value: 'bank' },
  { key: 'ufficio_postale', label: 'Ufficio postale', tag: 'amenity', value: 'post_office' },
  { key: 'parco', label: 'Parco/area verde', tag: 'leisure', value: 'park' },
  { key: 'parcheggio', label: 'Parcheggio pubblico', tag: 'amenity', value: 'parking' }
]

function tagFilterExpr(cat) {
  return cat.regex ? `["${cat.tag}"~"${cat.regex}"]` : `["${cat.tag}"="${cat.value}"]`
}

function buildOverpassQuery(lat, lng) {
  const clauses = CATEGORIES.map((cat) => {
    const f = tagFilterExpr(cat)
    return (
      `  node${f}(around:${SEARCH_RADIUS_METERS},${lat},${lng});\n` +
      `  way${f}(around:${SEARCH_RADIUS_METERS},${lat},${lng});`
    )
  }).join('\n')
  return `[out:json][timeout:20];\n(\n${clauses}\n);\nout center tags;`
}

// Formula dell'emisenoverso: distanza in metri tra due coordinate.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function matchCategory(tags) {
  return CATEGORIES.find((cat) => {
    const value = tags?.[cat.tag]
    if (!value) return false
    return cat.regex ? new RegExp(cat.regex).test(value) : value === cat.value
  })
}

function parseOverpassResponse(json, lat, lng) {
  if (!json || !Array.isArray(json.elements)) return null

  const byCategory = new Map(CATEGORIES.map((cat) => [cat.key, []]))

  for (const el of json.elements) {
    const elLat = el.lat ?? el.center?.lat
    const elLon = el.lon ?? el.center?.lon
    if (typeof elLat !== 'number' || typeof elLon !== 'number') continue

    const tags = el.tags || {}
    const category = matchCategory(tags)
    if (!category) continue

    const distanceMeters = Math.round(haversineMeters(lat, lng, elLat, elLon))
    const name = tags.name || tags.brand || category.label
    byCategory.get(category.key).push({ name, distanceMeters })
  }

  let totalFound = 0
  const categories = CATEGORIES.map((cat) => {
    const items = (byCategory.get(cat.key) || [])
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, MAX_ITEMS_PER_CATEGORY)
    totalFound += items.length
    return { key: cat.key, label: cat.label, items }
  }).filter((cat) => cat.items.length > 0)

  if (totalFound === 0) return null

  return {
    categories,
    radiusMeters: SEARCH_RADIUS_METERS,
    // Usato solo per calcolare il "punteggio comodità zona" nel report: senza
    // sapere quante categorie sono state cercate in totale, non si può capire
    // se 4 categorie trovate sono "quasi tutte" o "poche su molte".
    totalCategoriesSearched: CATEGORIES.length,
    fetchedAt: new Date().toISOString()
  }
}

async function fetchOverpass(query) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Identificarsi è buona pratica per i servizi pubblici condivisi
        // come Overpass (vedi policy di fair-use del progetto OSM).
        'User-Agent': 'ValutaFacile/1.0 (report valutazione immobiliare)'
      },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal
    })
    if (!response.ok) return null
    return await response.json()
  } catch (err) {
    console.warn('⚠️ Overpass: errore fetch', err.message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function buildCacheKey(lat, lng) {
  // Arrotondato a 4 decimali (~11 metri di precisione): abbastanza per
  // riusare la cache tra richieste quasi identiche senza sprecare spazio.
  return `${lat.toFixed(4)}|${lng.toFixed(4)}`
}

/**
 * Recupera i punti di interesse nelle vicinanze di una coordinata, con cache
 * su DB. Non lancia mai eccezioni: in caso di problemi ritorna `null`, così
 * il report può sempre essere generato (solo senza questa sezione extra).
 */
export async function getNearbyPoi({ lat, lng } = {}) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null
  }

  const cacheKey = buildCacheKey(lat, lng)

  const cachedSuccess = getCachedPoi(cacheKey, CACHE_TTL_SUCCESS_HOURS)
  if (cachedSuccess && cachedSuccess.success) {
    return cachedSuccess.payload
  }
  const cachedFailure = getCachedPoi(cacheKey, CACHE_TTL_FAILURE_HOURS)
  if (cachedFailure && !cachedFailure.success) {
    return null
  }

  const query = buildOverpassQuery(lat, lng)
  const json = await fetchOverpass(query)
  const parsed = json ? parseOverpassResponse(json, lat, lng) : null

  setCachedPoi(cacheKey, { success: !!parsed, payload: parsed })
  return parsed
}

export const _internal = {
  buildOverpassQuery,
  parseOverpassResponse,
  haversineMeters,
  CATEGORIES
}
