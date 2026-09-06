// Ricerca indirizzi (autocomplete) tramite Nominatim e Photon, eseguita
// lato server invece che direttamente dal browser.
//
// Perché lato server: chiamando Nominatim/Photon direttamente dal browser
// (com'era prima) capitava che Nominatim rispondesse con un generico
// "Network Error" (CORS/policy di fair-use: Nominatim scoraggia l'uso
// client-side massivo senza uno User-Agent identificativo, vedi
// https://operations.osmfoundation.org/policies/nominatim/) e che Photon
// rispondesse 400 in modo non deterministico. Chiamando questi servizi da
// server-to-server invece che browser-to-server: niente restrizioni CORS,
// possiamo impostare uno User-Agent corretto come richiesto dalla policy di
// Nominatim, e possiamo cachare/limitare le chiamate in un unico punto.
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const PHOTON_ENDPOINT = 'https://photon.komoot.io/api'
const USER_AGENT = 'ValutaFacile/1.0 (ricerca indirizzo immobile, contatto: info@valutafacile.it)'
const FETCH_TIMEOUT_MS = 5000

// Geoapify: fonte primaria (se configurata via GEOAPIFY_API_KEY). Copertura
// e precisione dei civici in Italia nettamente migliori di Nominatim/Photon
// pubblici, piano gratuito 3000 richieste/giorno senza carta di credito
// (limiti "soft": superarli non blocca il sito). Nominatim/Photon restano
// come fallback se la chiave non è impostata o Geoapify non risponde.
const GEOAPIFY_ENDPOINT = 'https://api.geoapify.com/v1/geocode/autocomplete'
const GEOAPIFY_REVERSE_ENDPOINT = 'https://api.geoapify.com/v1/geocode/reverse'
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || ''

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

async function searchGeoapifyServerSide(query) {
  if (!GEOAPIFY_API_KEY) return []
  try {
    const url = `${GEOAPIFY_ENDPOINT}?text=${encodeURIComponent(query)}&filter=countrycode:it&lang=it&limit=8&format=json&apiKey=${GEOAPIFY_API_KEY}`
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      console.warn('[geocodeSearch] Geoapify HTTP', response.status)
      return []
    }
    const data = await response.json()
    return Array.isArray(data?.results) ? data.results.map(formatGeoapifyResult) : []
  } catch (err) {
    console.warn('[geocodeSearch] Geoapify fallita:', err.message)
    return []
  }
}

async function searchNominatimServerSide(query) {
  try {
    const url = `${NOMINATIM_ENDPOINT}?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8&countrycodes=it`
    const response = await fetchWithTimeout(url, {
      headers: {
        'Accept-Language': 'it',
        'User-Agent': USER_AGENT
      }
    })
    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data) ? data.map(formatNominatimResult) : []
  } catch (err) {
    console.warn('[geocodeSearch] Nominatim fallita:', err.message)
    return []
  }
}

async function searchPhotonServerSide(query) {
  try {
    // NB: nessun filtro osm_tag qui — filtrare a place:city/town/village
    // escluderebbe per costruzione ogni risultato a livello di via/civico.
    const url = `${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}&limit=8&lang=it`
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': USER_AGENT }
    })
    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data?.features) ? data.features.map(formatPhotonResult) : []
  } catch (err) {
    console.warn('[geocodeSearch] Photon fallita:', err.message)
    return []
  }
}

// Costruisce il display nell'ordine italiano standard "Via X, civico,
// Comune, CAP, Provincia, Italia" partendo dai campi strutturati, invece di
// fidarsi del display_name/nome grezzo restituito dalle API (che per alcuni
// indirizzi mette il civico PRIMA del nome della via).
function buildItalianDisplayAddress({ street, housenumber, city, postcode, state }) {
  // Per i risultati "solo comune" (nessuna via specifica trovata), l'API
  // restituisce il nome del comune anche come "street" di fallback: senza
  // questo controllo comparirebbe due volte, es. "Anzano di Puglia, Anzano
  // di Puglia, ...".
  const streetIsSameAsCity = street && city && street.trim().toLowerCase() === city.trim().toLowerCase()
  const streetPart = streetIsSameAsCity ? '' : [street, housenumber].filter(Boolean).join(', ')
  const parts = [streetPart, city, postcode, state, 'Italia'].filter(Boolean)
  return parts.join(', ')
}

function extractStreetFromDisplay(displayName) {
  const parts = String(displayName || '').split(',')
  return parts[0]?.trim() || ''
}

function formatGeoapifyResult(result) {
  const street = result.street || result.address_line1 || ''
  const housenumber = result.housenumber || ''
  const city = result.city || result.county || ''
  const postcode = result.postcode || ''
  const state = result.state || ''

  return {
    display: buildItalianDisplayAddress({ street, housenumber, city, postcode, state }),
    street,
    housenumber,
    city,
    postcode,
    state,
    country: 'Italia',
    lat: result.lat,
    lon: result.lon,
    source: 'geoapify',
    // Geoapify fornisce già un punteggio di confidenza (rank.confidence,
    // 0-1) e indica il livello di dettaglio del match (result_type):
    // teniamo un punteggio alto per dare priorità a Geoapify rispetto a
    // Nominatim/Photon nella funzione deduplicateAndRank sotto.
    confidence: Math.min(1, 0.7 + (result.rank?.confidence || 0) * 0.3)
  }
}

function formatNominatimResult(result) {
  const address = result.address || {}
  const street = address.road || extractStreetFromDisplay(result.display_name)
  const housenumber = address.house_number || ''
  const city = address.city || address.town || address.village || ''
  const postcode = address.postcode || ''
  const state = address.state || ''

  return {
    display: buildItalianDisplayAddress({ street, housenumber, city, postcode, state }),
    street,
    housenumber,
    city,
    postcode,
    state,
    country: 'Italia',
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
    source: 'nominatim',
    confidence: calculateNominatimConfidence(result)
  }
}

function formatPhotonResult(feature) {
  const props = feature.properties || {}
  const coords = feature.geometry?.coordinates || [null, null]
  const street = props.street || props.name
  const housenumber = props.housenumber || ''
  const city = props.city || ''
  const postcode = props.postcode || ''
  const state = props.state || ''

  return {
    display: buildItalianDisplayAddress({ street, housenumber, city, postcode, state }),
    street,
    housenumber,
    city,
    postcode,
    state,
    country: 'Italia',
    lat: coords[1],
    lon: coords[0],
    source: 'photon',
    confidence: props.extent ? 0.8 : 0.6
  }
}

function calculateNominatimConfidence(result) {
  let score = 0.5
  if (result.address) {
    if (result.address.road) score += 0.2
    if (result.address.house_number) score += 0.1
    if (result.address.postcode) score += 0.1
    if (result.address.city) score += 0.1
  }
  return Math.min(score, 1.0)
}

function deduplicateAndRank(results) {
  const unique = []
  const tolerance = 0.001 // ~100m
  results.forEach((result) => {
    if (result.lat == null || result.lon == null || Number.isNaN(result.lat) || Number.isNaN(result.lon)) {
      // Senza coordinate valide teniamo comunque il risultato (non possiamo
      // fare deduplica geografica), ma solo se non è già presente uno
      // identico per via/città.
      const alreadyPresent = unique.some(
        (existing) => existing.street === result.street && existing.city === result.city
      )
      if (!alreadyPresent) unique.push(result)
      return
    }
    const isDuplicate = unique.some((existing) => {
      if (existing.lat == null || existing.lon == null) return false
      const distLat = Math.abs(existing.lat - result.lat)
      const distLon = Math.abs(existing.lon - result.lon)
      const nameMatch = existing.street === result.street && existing.city === result.city
      return (distLat < tolerance && distLon < tolerance) || nameMatch
    })
    if (!isDuplicate) unique.push(result)
  })
  return unique.sort((a, b) => {
    const sourceWeight = { geoapify: 3, nominatim: 2, photon: 1 }
    const aWeight = (sourceWeight[a.source] || 0) + (a.confidence || 0)
    const bWeight = (sourceWeight[b.source] || 0) + (b.confidence || 0)
    return bWeight - aWeight
  })
}

// Punto di ingresso usato dalla route /api/geocode/search. Interroga
// Nominatim e Photon in parallelo (se una fallisce l'altra può comunque
// restituire risultati) e ritorna un array deduplicato, già ordinato per
// rilevanza.
export async function searchAddressesServerSide(query) {
  if (!query || query.trim().length < 2) return []

  // Geoapify prima (se configurata): copertura/precisione civici migliore,
  // e risparmiamo la quota giornaliera gratuita evitando di interrogare
  // Nominatim/Photon quando Geoapify trova già risultati validi.
  if (GEOAPIFY_API_KEY) {
    const geoapifyResults = await searchGeoapifyServerSide(query)
    if (geoapifyResults.length > 0) {
      return deduplicateAndRank(geoapifyResults).slice(0, 10)
    }
  }

  const [nominatimResults, photonResults] = await Promise.all([
    searchNominatimServerSide(query),
    searchPhotonServerSide(query)
  ])
  return deduplicateAndRank([...nominatimResults, ...photonResults]).slice(0, 10)
}

async function reverseGeoapifyServerSide(lat, lon) {
  if (!GEOAPIFY_API_KEY) return null
  try {
    const url = `${GEOAPIFY_REVERSE_ENDPOINT}?lat=${lat}&lon=${lon}&lang=it&format=json&apiKey=${GEOAPIFY_API_KEY}`
    const response = await fetchWithTimeout(url)
    if (!response.ok) return null
    const data = await response.json()
    const result = Array.isArray(data?.results) ? data.results[0] : null
    if (!result) return null
    return {
      road: result.street || '',
      house_number: result.housenumber || '',
      city: result.city || result.county || '',
      postcode: result.postcode || '',
      state: result.state || ''
    }
  } catch (err) {
    console.warn('[geocodeSearch] Geoapify reverse fallito:', err.message)
    return null
  }
}

// Reverse geocoding (lat/lon -> indirizzo/CAP), usato per completare il CAP
// quando l'utente seleziona un punto sulla mappa senza CAP esplicito. Stesso
// motivo per farlo lato server: chiamare Nominatim direttamente dal browser
// causava "Network Error" non deterministici. Geoapify (se configurata) ha
// priorità per la stessa ragione di precisione della ricerca in avanti.
export async function reverseGeocodeServerSide(lat, lon) {
  const geoapifyAddress = await reverseGeoapifyServerSide(lat, lon)
  if (geoapifyAddress) return geoapifyAddress

  try {
    const url = `${NOMINATIM_ENDPOINT.replace('/search', '/reverse')}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    const response = await fetchWithTimeout(url, {
      headers: {
        'Accept-Language': 'it',
        'User-Agent': USER_AGENT
      }
    })
    if (!response.ok) return null
    const data = await response.json()
    return data?.address || null
  } catch (err) {
    console.warn('[geocodeSearch] Reverse geocoding fallito:', err.message)
    return null
  }
}
