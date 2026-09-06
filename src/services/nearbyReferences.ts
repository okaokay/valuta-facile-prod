import axios from 'axios'

export type NearbyCategory =
  | 'strada'
  | 'trasporti'
  | 'scuola'
  | 'negozio'
  | 'ristorante'
  | 'parco'
  | 'poi'

export type NearbyRef = {
  id: string
  name: string
  category: NearbyCategory
  distanceM: number
  bearingDeg: number
}

type OverpassElement = {
  id: number
  type: 'node' | 'way' | 'relation'
  lat?: number
  lon?: number
  center?: {
    lat: number
    lon: number
  }
  tags?: Record<string, string>
}

const cache = new Map<string, NearbyRef[]>()

function generateFallbackNearbyRefs(): NearbyRef[] {
  const base: NearbyRef[] = [
    {
      id: 'fallback/strada_principale',
      name: 'Strada principale del quartiere',
      category: 'strada',
      distanceM: 120,
      bearingDeg: 0
    },
    {
      id: 'fallback/parco',
      name: 'Parco pubblico',
      category: 'parco',
      distanceM: 260,
      bearingDeg: 110
    },
    {
      id: 'fallback/scuola',
      name: 'Scuola elementare',
      category: 'scuola',
      distanceM: 380,
      bearingDeg: 210
    },
    {
      id: 'fallback/negozio',
      name: 'Supermercato di zona',
      category: 'negozio',
      distanceM: 340,
      bearingDeg: 290
    },
    {
      id: 'fallback/ristorante',
      name: 'Ristorante di quartiere',
      category: 'ristorante',
      distanceM: 420,
      bearingDeg: 60
    },
    {
      id: 'fallback/trasporti',
      name: 'Fermata autobus',
      category: 'trasporti',
      distanceM: 280,
      bearingDeg: 150
    }
  ]

  return base
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function bearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (v: number) => (v * Math.PI) / 180
  const toDeg = (v: number) => (v * 180) / Math.PI
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lon2 - lon1)

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x)
  const bearing = (toDeg(θ) + 360) % 360
  return bearing
}

function mapTagsToCategory(tags: Record<string, string>): NearbyCategory {
  const { amenity, shop, tourism, leisure, public_transport, highway } = tags

  if (highway) {
    return 'strada'
  }

  if (public_transport || amenity === 'bus_station' || amenity === 'bus_stop') {
    return 'trasporti'
  }

  if (amenity === 'school' || amenity === 'college' || amenity === 'university') {
    return 'scuola'
  }

  if (
    amenity === 'restaurant' ||
    amenity === 'cafe' ||
    amenity === 'fast_food' ||
    amenity === 'bar'
  ) {
    return 'ristorante'
  }

  if (shop) {
    return 'negozio'
  }

  if (
    leisure === 'park' ||
    leisure === 'garden' ||
    leisure === 'playground' ||
    tourism === 'attraction'
  ) {
    return 'parco'
  }

  return 'poi'
}

function isGenericName(name: string): boolean {
  if (!name) return true
  const trimmed = name.trim()
  if (!trimmed) return true

  const lower = trimmed.toLowerCase()

  const genericValues = new Set([
    'unnamed road',
    'unamed road',
    'road',
    'strada senza nome',
    'senza nome',
    's.n.',
    'sn',
    'yes',
    'unknown',
    'null',
    'undefined'
  ])

  if (genericValues.has(lower)) return true

  // Un singolo carattere o solo numeri non ha senso come riferimento
  if (trimmed.length <= 1) return true
  if (/^\d+$/.test(trimmed)) return true

  return false
}

function dedupeAndSort(refs: NearbyRef[]): NearbyRef[] {
  const seen = new Map<string, NearbyRef>()

  for (const ref of refs) {
    const key = `${ref.category}|${ref.name.trim().toLowerCase()}`
    const existing = seen.get(key)
    if (!existing || ref.distanceM < existing.distanceM) {
      seen.set(key, ref)
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.distanceM - b.distanceM)
}

export async function fetchNearbyReferences(
  lat: number,
  lng: number,
  radius = 700
): Promise<NearbyRef[]> {
  if (!lat || !lng) {
    const fallbackKey = 'fallback'
    const cachedFallback = cache.get(fallbackKey)
    if (cachedFallback) {
      return cachedFallback
    }
    const fallback = generateFallbackNearbyRefs()
    cache.set(fallbackKey, fallback)
    return fallback
  }

  const key = `${lat.toFixed(5)}|${lng.toFixed(5)}|${radius}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }

  const query = `
[out:json][timeout:25];
(
  node(around:${radius},${lat},${lng})[name][amenity];
  node(around:${radius},${lat},${lng})[name][shop];
  node(around:${radius},${lat},${lng})[name][tourism];
  node(around:${radius},${lat},${lng})[name][leisure];
  node(around:${radius},${lat},${lng})[name][public_transport];
  way(around:${radius},${lat},${lng})[name][highway];
  relation(around:${radius},${lat},${lng})[name][highway];
);
out center;
`.trim()

  try {
    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(query)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept-Language': 'it'
        },
        timeout: 25000
      }
    )

    const data = response.data
    const elements: OverpassElement[] = data?.elements || []

    const refs: NearbyRef[] = elements
      .map((el) => {
        const tags = el.tags || {}
        const rawName =
          tags.name || tags.ref || tags.operator || tags['addr:street']
        if (!rawName || isGenericName(rawName)) return null

        const coordLat = el.lat ?? el.center?.lat
        const coordLon = el.lon ?? el.center?.lon
        if (coordLat == null || coordLon == null) return null

        const distanceM = haversineMeters(lat, lng, coordLat, coordLon)
        const bearingDeg = bearingDegrees(lat, lng, coordLat, coordLon)
        const category = mapTagsToCategory(tags)

        const id = `${el.type}/${el.id}`

        const ref: NearbyRef = {
          id,
          name: rawName,
          category,
          distanceM,
          bearingDeg
        }

        return ref
      })
      .filter((r): r is NearbyRef => Boolean(r))

    const normalized = dedupeAndSort(refs).slice(0, 25)

    if (!normalized.length) {
      if (import.meta.env?.MODE !== 'production') {
        console.warn(
          '🌐 nearbyReferences: nessun riferimento reale trovato, uso fallback simulato',
          { lat, lng, radius }
        )
      }
      const fallback = generateFallbackNearbyRefs()
      cache.set(key, fallback)
      return fallback
    }
    if (import.meta.env?.MODE !== 'production') {
      console.log('🌐 nearbyReferences: trovati riferimenti', normalized.length, {
        lat,
        lng,
        radius,
        sample: normalized.slice(0, 5)
      })
    }
    cache.set(key, normalized)
    return normalized
  } catch (error) {
    console.error('Errore fetchNearbyReferences Overpass:', error)
    const fallback = generateFallbackNearbyRefs()
    cache.set(`${lat || 'fallback'}|${lng || 'fallback'}|${radius}`, fallback)
    return fallback
  }
}
