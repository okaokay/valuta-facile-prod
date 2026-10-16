const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

// Trova il banner/video dell'affiliato idoneo per l'immobile valutato (entro
// il raggio impostato dall'affiliato stesso) — vedi GET /api/ads/match lato
// server. Fallisce silenziosamente (nessuna pubblicità mostrata) se il
// backend non è raggiungibile: non deve mai bloccare la visualizzazione
// della valutazione.
// Se lat/lng non sono disponibili (pagine senza un indirizzo preciso, es.
// homepage o pagine città/provincia), il backend prova comunque a stimare
// la posizione dall'IP del visitatore (Fase 4) — in quel caso si chiama
// senza questi parametri, non si rinuncia alla richiesta.
export async function fetchMatchingAd({ lat, lng, cap, tipo } = {}) {
  if (!API_BASE_URL) {
    return { ad: null }
  }
  try {
    const params = new URLSearchParams()
    if (typeof lat === 'number' && typeof lng === 'number') {
      params.set('lat', String(lat))
      params.set('lng', String(lng))
    }
    if (cap) params.set('cap', cap)
    // 'video' forza il backend a restituire solo campagne video (usato dal
    // gate pre-valutazione, che non ha senso mostri un banner statico), vedi
    // filtro lato server in GET /api/ads/match. Omesso: va bene qualsiasi tipo.
    if (tipo) params.set('tipo', tipo)
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
