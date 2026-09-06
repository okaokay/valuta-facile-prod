import { useEffect } from 'react'

let adsenseScriptLoaded = false

function loadAdsenseScript(pubId) {
  if (adsenseScriptLoaded || !pubId) return
  if (document.querySelector('script[data-adsbygoogle]')) {
    adsenseScriptLoaded = true
    return
  }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pubId}`
  script.crossOrigin = 'anonymous'
  script.setAttribute('data-adsbygoogle', 'true')
  document.head.appendChild(script)
  adsenseScriptLoaded = true
}

// Riquadro banner Display Google AdSense.
// slotEnvVar: nome della variabile d'ambiente Vite che contiene l'Ad Slot ID
// per questa specifica posizione (es. 'VITE_ADSENSE_SLOT_HOME').
// Finché Publisher ID e Slot ID non sono configurati mostra solo un placeholder,
// così la posizione è già pronta per quando Google approverà l'account.
function AdBanner({ slotEnvVar, placeholderLabel = 'Spazio pubblicitario', className = '' }) {
  const pubId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID
  const adSlot = slotEnvVar ? import.meta.env[slotEnvVar] : null

  useEffect(() => {
    if (!pubId || !adSlot) return
    loadAdsenseScript(pubId)
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {
      console.error('Errore inizializzazione banner AdSense:', e)
    }
  }, [pubId, adSlot])

  if (!pubId || !adSlot) {
    return (
      <div
        className={`w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[11px] text-slate-400 py-6 ${className}`}
      >
        {placeholderLabel}
      </div>
    )
  }

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={pubId}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}

export default AdBanner
