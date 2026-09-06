import { useState, useEffect, useRef } from 'react'

// Gate video obbligatorio prima di mostrare la valutazione.
// mode:
//  - 'demo_rewarded' -> video finto/placeholder (5s), usato per collaudare il flusso
//  - 'live_rewarded'  -> Google Rewarded Ads reali (richiede VITE_ADSENSE_PUBLISHER_ID
//                        e VITE_ADSENSE_AD_UNIT); se non configurati, ricade sul demo
function ValuationAdGateModal({ mode, onUnlock, onClose }) {
  const [phase, setPhase] = useState('intro') // intro | loading | playing | rewarded
  const [countdown, setCountdown] = useState(0)
  const cleanupRef = useRef(null)

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [])

  const runDemoCountdown = () => {
    let count = 5
    setCountdown(count)
    setPhase('playing')
    const interval = setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count <= 0) {
        clearInterval(interval)
        setPhase('rewarded')
        setTimeout(() => onUnlock(), 700)
      }
    }, 1000)
    cleanupRef.current = () => clearInterval(interval)
  }

  const startAd = () => {
    setPhase('loading')
    const isLive = mode === 'live_rewarded'
    const pubId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID
    const adUnit = import.meta.env.VITE_ADSENSE_AD_UNIT

    if (!isLive || !pubId || !adUnit) {
      // Modalità demo (o live senza credenziali ancora configurate): countdown finto
      runDemoCountdown()
      return
    }

    // Modalità live: Google Publisher Tag - Rewarded Ad reale
    const g = (window.googletag = window.googletag || { cmd: [] })
    const script = document.createElement('script')
    script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
    script.async = true
    script.onload = () => {
      g.cmd.push(() => {
        g.defineOutOfPageSlot(`/${pubId}/${adUnit}`, g.enums.OutOfPageFormat.REWARDED)
          .addService(g.pubads())
        g.pubads().addEventListener('rewardedSlotReady', evt => {
          setPhase('playing')
          evt.makeRewardedVisible()
        })
        g.pubads().addEventListener('rewardedSlotGranted', () => {
          setPhase('rewarded')
          setTimeout(() => onUnlock(), 700)
        })
        g.pubads().addEventListener('rewardedSlotClosed', () => {
          setPhase('intro')
        })
        g.enableServices()
        g.display('gpt-rewarded-valuation')
      })
    }
    script.onerror = () => {
      // Se il caricamento reale fallisce, non blocchiamo l'utente: fallback demo
      runDemoCountdown()
    }
    document.head.appendChild(script)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[82]" aria-hidden="true" />
      <div
        className="fixed inset-0 flex items-center justify-center z-[83] p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[10px_10px_0_#1e293b] w-full max-w-lg p-8 relative">
          {phase === 'intro' && (
            <div className="flex flex-col gap-6 items-center text-center">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
                  Ultimo passo
                </p>
                <h2 className="text-2xl font-black text-slate-900">
                  Guarda un breve video per sbloccare la valutazione
                </h2>
                <p className="text-slate-500 text-sm mt-2">
                  È il modo con cui Valuta Facile offre gratuitamente questo servizio. Al
                  termine del video vedrai subito il valore stimato del tuo immobile.
                </p>
              </div>
              <button
                onClick={startAd}
                className="w-full bg-slate-900 text-white font-black rounded-full py-3 px-6 shadow-[4px_4px_0_#94a3b8] hover:shadow-[2px_2px_0_#94a3b8] active:shadow-none transition-all"
              >
                Guarda il video e sblocca
              </button>
              <button onClick={onClose} className="text-sm text-slate-400 underline">
                No grazie
              </button>
            </div>
          )}

          {(phase === 'loading' || phase === 'playing' || phase === 'rewarded') && (
            <div className="flex flex-col gap-6 items-center text-center">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
                  Quasi fatto
                </p>
                <h2 className="text-2xl font-black text-slate-900">
                  {phase === 'rewarded' ? 'Valutazione sbloccata!' : 'Video in corso'}
                </h2>
              </div>

              <div id="gpt-rewarded-valuation" className="w-full">
                {phase === 'loading' && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <div className="animate-spin h-10 w-10 border-4 border-slate-900 border-t-transparent rounded-full" />
                    <p className="text-slate-500 text-sm">Caricamento annuncio…</p>
                  </div>
                )}

                {phase === 'playing' && countdown > 0 && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <div className="w-20 h-20 rounded-full border-4 border-indigo-600 flex items-center justify-center">
                      <span className="text-3xl font-black text-indigo-600">{countdown}</span>
                    </div>
                    <p className="text-slate-500 text-sm mt-2">Annuncio in corso…</p>
                    <p className="text-xs text-slate-400">Non chiudere questa finestra</p>
                  </div>
                )}

                {phase === 'playing' && countdown === 0 && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <span className="text-5xl">🎬</span>
                    <p className="text-slate-500 text-sm">Annuncio in corso…</p>
                  </div>
                )}

                {phase === 'rewarded' && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <div className="w-16 h-16 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center text-3xl">
                      ✓
                    </div>
                    <p className="font-bold text-green-700 text-sm">
                      Ottimo! La tua valutazione è pronta.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default ValuationAdGateModal
