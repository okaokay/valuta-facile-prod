import { useEffect, useRef, useState } from 'react'
import { fetchMatchingAd, trackAdClick } from '../../services/adsService'

// Mostra il banner/video dell'affiliato pubblicitario geolocalizzato più
// adatto alla zona dell'immobile appena valutato (vedi GET /api/ads/match).
// Se nessun affiliato è idoneo per quella zona, il componente non renderizza
// nulla: a differenza del placeholder AdSense (spazio sempre riservato),
// qui non ha senso mostrare un riquadro vuoto finché non ci sono affiliati
// configurati per quel CAP.
function AffiliateAdSlot({ lat, lng, cap, className = '' }) {
  const [ad, setAd] = useState(null)
  const fetchedKeyRef = useRef(null)

  useEffect(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    // Evita di richiedere/registrare una nuova impression ad ogni re-render
    // dello stesso indirizzo (es. cambio di altri campi del wizard).
    if (fetchedKeyRef.current === key) return
    fetchedKeyRef.current = key
    let cancelled = false
    fetchMatchingAd({ lat, lng, cap }).then((data) => {
      if (!cancelled) setAd(data?.ad || null)
    })
    return () => {
      cancelled = true
    }
  }, [lat, lng, cap])

  if (!ad) return null

  const handleClick = () => {
    trackAdClick(ad.campaignId, { cap })
  }

  return (
    <div className={`w-full overflow-hidden rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0_rgba(15,23,42,1)] ${className}`}>
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Promosso
      </div>
      {ad.tipo === 'video' ? (
        <a
          href={ad.linkDestinazione || undefined}
          target={ad.linkDestinazione ? '_blank' : undefined}
          rel={ad.linkDestinazione ? 'noopener noreferrer sponsored' : undefined}
          onClick={handleClick}
        >
          <video
            src={ad.mediaUrl}
            className="w-full max-h-80 object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        </a>
      ) : (
        <a
          href={ad.linkDestinazione || undefined}
          target={ad.linkDestinazione ? '_blank' : undefined}
          rel={ad.linkDestinazione ? 'noopener noreferrer sponsored' : undefined}
          onClick={handleClick}
        >
          <img src={ad.mediaUrl} alt="Pubblicità" className="w-full object-cover" />
        </a>
      )}
    </div>
  )
}

export default AffiliateAdSlot
