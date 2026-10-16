const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

// Trova il banner/video dell'affiliato idoneo per l'immobile valutato (entro
// il raggio impostato dall'affiliato stesso) — vedi GET /api/ads/match lato
// server. Fallisce silenziosamente (nessuna pubblicità mostrata) se il
// backend non è raggiungibile: non deve mai bloccare la visualizzazione
// della valutazione.
export async function fetchMatchingAd({ lat, lng, cap }) {
  if (!API_BASE_URL || typeof lat !== 'number' || typeof lng !== 'number') {
    return { ad: null }
  }
  try {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
    if (cap) params.set('cap', cap)
    const response = await fetch(`${API_BASE_URL}/ads/match?${params.toString()}`)
    if (!response.ok) return { ad: null }
    return response.json()
  } catch (e) {
    console.error('Errore ricerca pubblicità affiliato:', e)
    return { ad: null }
  }
}

export async function trackAdClick(campaignId, { cap } = {}) {
  if (!API_BASE_URL || !campaignId) return
  try {
    await fetch(`${API_BASE_URL}/ads/${campaignId}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cap })
    })
  } catch (e) {
    console.error('Errore tracciamento click pubblicità affiliato:', e)
  }
}
