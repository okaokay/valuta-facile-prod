import { getCachedIpGeo, setCachedIpGeo } from '../db.js'

// Usato per stimare la posizione di un visitatore quando NON ha ancora
// inserito un indirizzo da valutare (homepage, pagine città/provincia): è
// un fallback meno preciso (a livello di città, non di indirizzo esatto)
// rispetto al matching Fase 2 basato sull'indirizzo geocodificato
// dell'immobile, usato quando disponibile.
const IP_GEO_CACHE_MAX_AGE_HOURS = 72

function isPrivateOrLocalIp(ip) {
  if (!ip) return true
  const v = String(ip).replace('::ffff:', '')
  return (
    v === '127.0.0.1' ||
    v === '::1' ||
    /^10\./.test(v) ||
    /^192\.168\./.test(v) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v)
  )
}

// Servizio gratuito senza chiave (ip-api.com, limite 45 richieste/minuto sul
// piano free): sufficiente grazie alla cache sopra. Restituisce null se l'IP
// è privato/locale (dev, VPN interne) o se la geolocalizzazione fallisce —
// in quel caso semplicemente non si mostra alcuna pubblicità geolocalizzata,
// mai un errore bloccante per l'utente.
export async function geolocateIp(ip) {
  if (isPrivateOrLocalIp(ip)) return null

  const cached = getCachedIpGeo(ip, IP_GEO_CACHE_MAX_AGE_HOURS)
  if (cached) return cached.success ? cached.payload : null

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,zip,lat,lon,regionName,country`
    )
    const data = await response.json()
    if (data?.status !== 'success' || typeof data.lat !== 'number' || typeof data.lon !== 'number') {
      setCachedIpGeo(ip, { success: false, payload: null })
      return null
    }
    const payload = {
      lat: data.lat,
      lon: data.lon,
      cap: data.zip || null,
      city: data.city || null
    }
    setCachedIpGeo(ip, { success: true, payload })
    return payload
  } catch (e) {
    console.error('[ipGeolocation] Errore geolocalizzazione IP:', e.message)
    setCachedIpGeo(ip, { success: false, payload: null })
    return null
  }
}
