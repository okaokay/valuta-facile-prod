import { useState, useEffect, useRef } from 'react'

interface ReportUnlockModalProps {
  onClose: () => void
  leadId: number | null
  valuationId?: string
}

type Phase = 'choice' | 'video' | 'email-form' | 'success'

// VITE_API_BASE_URL include già /api (es. http://localhost:4001/api)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string || '').replace(/\/+$/, '') || 'http://localhost:4001/api'

export default function ReportUnlockModal({ onClose, leadId, valuationId }: ReportUnlockModalProps) {
  const [phase, setPhase] = useState<Phase>('choice')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [videoState, setVideoState] = useState<'idle' | 'loading' | 'playing' | 'rewarded'>('idle')
  const [videoCountdown, setVideoCountdown] = useState(0)
  const offerwallCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => { offerwallCleanupRef.current?.() }
  }, [])

  async function handlePayment() {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`${API_BASE}/payment/create-session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, valuationId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore pagamento')
      window.location.href = data.url
    } catch (err: any) {
      setSubmitError(err.message || 'Errore. Riprova.')
      setIsSubmitting(false)
    }
  }

  function handleVideoChoice() {
    setPhase('video')
    setVideoState('loading')
    startOfferwall(() => {
      setVideoState('rewarded')
      setTimeout(() => handleRewardGranted(), 700)
    })
  }

  function startOfferwall(onReward: () => void) {
    const pubId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID as string | undefined
    const adUnit = import.meta.env.VITE_ADSENSE_AD_UNIT as string | undefined

    if (!pubId || !adUnit) {
      // Dev fallback: 5-second countdown simulates watched ad
      let count = 5
      setVideoCountdown(count)
      setVideoState('playing')
      const interval = setInterval(() => {
        count -= 1
        setVideoCountdown(count)
        if (count <= 0) {
          clearInterval(interval)
          onReward()
        }
      }, 1000)
      offerwallCleanupRef.current = () => clearInterval(interval)
      return
    }

    // Production: Google Publisher Tag rewarded ad
    const g = ((window as any).googletag = (window as any).googletag || { cmd: [] })
    const script = document.createElement('script')
    script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
    script.async = true
    script.onload = () => {
      g.cmd.push(() => {
        g.defineOutOfPageSlot(`/${pubId}/${adUnit}`, g.enums.OutOfPageFormat.REWARDED)
          .addService(g.pubads())
        g.pubads().addEventListener('rewardedSlotReady', (evt: any) => {
          setVideoState('playing')
          evt.makeRewardedVisible()
        })
        g.pubads().addEventListener('rewardedSlotGranted', () => onReward())
        g.pubads().addEventListener('rewardedSlotClosed', () => {
          setVideoState('idle')
          setPhase('choice')
        })
        g.enableServices()
        g.display('gpt-rewarded')
      })
    }
    document.head.appendChild(script)
  }

  function handleRewardGranted() {
    setPhase('email-form')
  }

  async function handleFreeUnlock(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setSubmitError(null)

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Inserisci un indirizzo email valido.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/report/free-unlock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, leadId })
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'disposable_email') {
          setEmailError('Usa un indirizzo email reale per ricevere il report.')
        } else {
          throw new Error(data.message || 'Errore. Riprova.')
        }
        return
      }
      setPhase('success')
    } catch (err: any) {
      setSubmitError(err.message || 'Errore di connessione. Riprova.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[82]"
        onClick={phase !== 'success' ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center z-[83] p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[10px_10px_0_#1e293b] w-full max-w-lg p-8 relative">

          {/* X chiudi */}
          {phase !== 'success' && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 text-xl font-bold leading-none"
              aria-label="Chiudi"
            >
              ✕
            </button>
          )}

          {/* === CHOICE === */}
          {phase === 'choice' && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Report completo</p>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">
                  Sblocca il report dettagliato
                </h2>
                <p className="text-slate-500 text-sm mt-2">
                  Ricevi il PDF con valutazione OMI, analisi AI, punti di forza e debolezza del tuo immobile.
                </p>
              </div>

              {submitError && (
                <div className="border-2 border-red-400 bg-red-50 rounded-xl p-3 text-red-700 text-sm">
                  {submitError}
                </div>
              )}

              {/* Opzione A: Paga */}
              <button
                onClick={handlePayment}
                disabled={isSubmitting}
                className="w-full flex items-center gap-4 border-2 border-slate-900 rounded-2xl p-5 text-left hover:bg-slate-50 shadow-[4px_4px_0_#1e293b] hover:shadow-[2px_2px_0_#1e293b] active:shadow-none transition-all disabled:opacity-50"
              >
                <span className="text-3xl">💳</span>
                <div className="flex-1">
                  <p className="font-black text-slate-900 text-base">Acquista il report — €5</p>
                  <p className="text-slate-500 text-xs mt-0.5">PDF scaricabile subito, salvato nel tuo profilo</p>
                </div>
                <span className="text-slate-400 text-lg">→</span>
              </button>

              {/* Opzione B: Video */}
              <button
                onClick={handleVideoChoice}
                disabled={isSubmitting}
                className="w-full flex items-center gap-4 border-2 border-slate-300 rounded-2xl p-5 text-left hover:border-slate-900 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                <span className="text-3xl">📺</span>
                <div className="flex-1">
                  <p className="font-black text-slate-900 text-base">Guarda un breve video</p>
                  <p className="text-slate-500 text-xs mt-0.5">Gratis — ricevi il report via email dopo il video</p>
                </div>
                <span className="text-slate-400 text-lg">→</span>
              </button>

              <p className="text-xs text-slate-400 text-center">
                Il report è generato in base ai dati OMI e alla tua valutazione.
              </p>
            </div>
          )}

          {/* === VIDEO === */}
          {phase === 'video' && (
            <div className="flex flex-col gap-6 items-center text-center">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Quasi fatto</p>
                <h2 className="text-2xl font-black text-slate-900">
                  {videoState === 'rewarded' ? 'Report sbloccato!' : 'Guarda il video'}
                </h2>
                <p className="text-slate-500 text-sm mt-2">
                  {videoState === 'rewarded'
                    ? 'Inserisci la tua email per riceverlo.'
                    : 'Al termine riceverai il report gratuito via email.'}
                </p>
              </div>

              {/* Container per AdSense GPT — in prod Google renderizza l'overlay, in dev mostriamo il countdown */}
              <div id="gpt-rewarded" className="w-full">
                {videoState === 'loading' && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <div className="animate-spin h-10 w-10 border-4 border-slate-900 border-t-transparent rounded-full" />
                    <p className="text-slate-500 text-sm">Caricamento annuncio…</p>
                  </div>
                )}

                {videoState === 'playing' && videoCountdown > 0 && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <div className="w-20 h-20 rounded-full border-4 border-indigo-600 flex items-center justify-center">
                      <span className="text-3xl font-black text-indigo-600">{videoCountdown}</span>
                    </div>
                    <p className="text-slate-500 text-sm mt-2">Annuncio in corso…</p>
                    <p className="text-xs text-slate-400">Non chiudere questa finestra</p>
                  </div>
                )}

                {videoState === 'playing' && videoCountdown === 0 && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <span className="text-5xl">🎬</span>
                    <p className="text-slate-500 text-sm">Annuncio in corso…</p>
                    <p className="text-xs text-slate-400">Il report sarà tuo al termine del video</p>
                  </div>
                )}

                {videoState === 'rewarded' && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <div className="w-16 h-16 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center text-3xl">
                      ✓
                    </div>
                    <p className="font-bold text-green-700 text-sm">Ottimo! Report sbloccato.</p>
                  </div>
                )}
              </div>

              {videoState === 'idle' && (
                <button onClick={() => setPhase('choice')} className="text-sm text-slate-400 underline">
                  Torna indietro
                </button>
              )}
            </div>
          )}

          {/* === EMAIL FORM === */}
          {phase === 'email-form' && (
            <form onSubmit={handleFreeUnlock} className="flex flex-col gap-5">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Ultimo passo</p>
                <h2 className="text-2xl font-black text-slate-900">Dove ti mandiamo il report?</h2>
                <p className="text-slate-500 text-sm mt-2">
                  Inserisci la tua email per ricevere il PDF e accedere al tuo profilo.
                </p>
              </div>

              {submitError && (
                <div className="border-2 border-red-400 bg-red-50 rounded-xl p-3 text-red-700 text-sm">
                  {submitError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-bold text-slate-700" htmlFor="unlock-email">
                  Email
                </label>
                <input
                  id="unlock-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(null) }}
                  className={`border-2 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 ${emailError ? 'border-red-500' : 'border-slate-900'}`}
                  placeholder="nome@esempio.it"
                />
                {emailError && <p className="text-red-600 text-xs mt-0.5">{emailError}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-slate-900 text-white font-black rounded-full py-3 px-6 shadow-[4px_4px_0_#94a3b8] hover:shadow-[2px_2px_0_#94a3b8] active:shadow-none transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Invio in corso…' : 'Ricevi il report gratis'}
              </button>

              <p className="text-xs text-slate-400 text-center">
                Riceverai anche un link per accedere al tuo profilo dove riesaminare la valutazione.
              </p>
            </form>
          )}

          {/* === SUCCESS === */}
          {phase === 'success' && (
            <div className="flex flex-col gap-6 items-center text-center">
              <div className="w-16 h-16 bg-green-100 border-2 border-green-500 rounded-full flex items-center justify-center text-3xl">
                ✓
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Report in arrivo!</h2>
                <p className="text-slate-500 text-sm mt-2">
                  Controlla la tua casella email. Troverai anche il link per accedere al tuo profilo.
                </p>
              </div>
              <button
                onClick={onClose}
                className="bg-slate-900 text-white font-black rounded-full py-3 px-8 shadow-[4px_4px_0_#94a3b8] hover:shadow-[2px_2px_0_#94a3b8] active:shadow-none transition-all"
              >
                Chiudi
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
