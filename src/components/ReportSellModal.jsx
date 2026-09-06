import { useState, useEffect } from 'react'
import { authClient } from '../lib/auth-client'
import AuthModal from './auth/AuthModal'
import ValuationAdGateModal from './ValuationAdGateModal'
import { INVITE_TOKEN_STORAGE_KEY } from './InviteGate'

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '') || 'http://localhost:4001/api'

// Testo persuasivo differenziato in base al profilo scelto nel wizard ("Richiedi come")
const PROFILE_PITCH = {
  PROPRIETARIO: {
    title: 'Vuoi vendere al prezzo giusto?',
    body:
      'Il report ti mostra i punti di forza da mettere in evidenza negli annunci e i punti deboli da sistemare (o da usare per giustificare il prezzo) prima di trattare con agenzie o acquirenti.'
  },
  CLIENTE_ACQUIRENTE: {
    title: "Prima di fare un'offerta, sappi cosa stai comprando davvero.",
    body:
      "Il report ti segnala i punti deboli dell'immobile che puoi usare per negoziare uno sconto, e ti conferma se il prezzo richiesto è in linea col mercato."
  },
  PROFESSIONISTA: {
    title: 'Presenta ai tuoi clienti un report pronto, professionale.',
    body:
      'Risparmi il tempo di costruirlo da zero e rafforzi la tua consulenza con punti di forza, criticità e potenziale di vendita già argomentati.'
  }
}
const DEFAULT_PITCH = {
  title: 'Scopri di più sul tuo immobile',
  body:
    'Il report completo mostra punti di forza, criticità e potenziale di vendita basati sui dati della tua zona.'
}

// Card di vendita del report PDF, sempre visibile in pagina (non più nascosta dietro un
// link). Doppia scelta pagamento/video, con il video disponibile solo quando adMode è
// demo_rewarded o live_rewarded (altrimenti Google non ha ancora approvato le Rewarded Ads).
// Il pagamento/registrazione/video si aprono come step successivi in overlay, ma il punto
// di partenza (testo + bottoni) resta sempre in vista nella pagina.
function ReportSellModal({ profileType, adMode, leadId, onUnlocked, className = '' }) {
  const { data: session } = authClient.useSession()
  const [phase, setPhase] = useState('intro') // intro | pay-info | auth | video | loading
  const [pendingAction, setPendingAction] = useState(null) // 'video' | 'pay'
  const [credits, setCredits] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  // Fase pre-lancio: chi è entrato con un codice invito (vedi InviteGate.jsx)
  // non paga né guarda video — lascia un feedback obbligatorio sulla
  // valutazione appena vista e riceve subito il report gratis in download.
  const inviteToken =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(INVITE_TOKEN_STORAGE_KEY)
      : null
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)

  const videoAllowed = adMode === 'demo_rewarded' || adMode === 'live_rewarded'
  const pitch = PROFILE_PITCH[profileType] || DEFAULT_PITCH

  async function submitFeedbackAndDownload() {
    if (!feedbackText.trim()) {
      setFeedbackError('Scrivi qualche riga di feedback prima di scaricare il report: è la parte più importante di questo test.')
      return
    }
    setFeedbackBusy(true)
    setFeedbackError('')
    try {
      const res = await fetch(`${API_BASE}/report/unlock-with-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, feedback: feedbackText.trim(), inviteToken })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message || 'Errore nella generazione del report. Riprova.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'valutazione-immobile.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setFeedbackDone(true)
      onUnlocked()
    } catch (err) {
      setFeedbackError(err.message || 'Errore. Riprova.')
    } finally {
      setFeedbackBusy(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetch(`${API_BASE}/report/credits`, { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(data => setCredits(data?.balance ?? 0))
        .catch(() => setCredits(0))
    } else {
      setCredits(null)
    }
  }, [session?.user])

  async function unlockWithCredit() {
    setIsBusy(true)
    setErrorMsg('')
    try {
      const res = await fetch(`${API_BASE}/report/consume-credit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Errore. Riprova.')
      onUnlocked()
    } catch (err) {
      setErrorMsg(err.message || 'Errore. Riprova.')
      setIsBusy(false)
    }
  }

  async function unlockFreeAfterVideo() {
    setPhase('loading')
    try {
      const res = await fetch(`${API_BASE}/report/unlock-free`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Errore. Riprova.')
      onUnlocked()
    } catch (err) {
      setErrorMsg(err.message || 'Errore. Riprova.')
      setPhase('intro')
    }
  }

  async function startPayment() {
    setIsBusy(true)
    setErrorMsg('')
    try {
      const res = await fetch(`${API_BASE}/payment/create-session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, redirectTo: '/profilo' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore pagamento')
      window.location.href = data.url
    } catch (err) {
      setErrorMsg(err.message || 'Errore. Riprova.')
      setIsBusy(false)
    }
  }

  function proceedWithAction(action) {
    if (action === 'video') {
      setPhase('video')
    } else if (action === 'pay') {
      setPhase('pay-info')
    }
  }

  function handleChoice(action) {
    if (!session?.user) {
      setPendingAction(action)
      setPhase('auth')
      return
    }
    proceedWithAction(action)
  }

  function handleAuthSuccess() {
    const action = pendingAction
    setPendingAction(null)
    setPhase('intro')
    // Se questa valutazione era stata creata da anonimo (prima del login/registrazione
    // appena avvenuti), colleghiamola subito all'account: altrimenti il lead resta
    // "orfano" e un eventuale pagamento non saprebbe a quale valutazione riferirsi.
    if (leadId) {
      fetch(`${API_BASE}/report/claim-lead`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      }).catch(() => {})
    }
    if (action) {
      // piccolo margine per lasciare che la sessione si aggiorni prima di procedere
      setTimeout(() => proceedWithAction(action), 300)
    }
  }

  if (phase === 'auth') {
    return <AuthModal onClose={() => setPhase('intro')} onSuccess={handleAuthSuccess} />
  }

  if (phase === 'video') {
    return (
      <ValuationAdGateModal
        mode={adMode}
        onUnlock={unlockFreeAfterVideo}
        onClose={() => setPhase('intro')}
      />
    )
  }

  if (phase === 'pay-info' || phase === 'loading') {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-[82]" aria-hidden="true" />
        <div
          className="fixed inset-0 flex items-center justify-center z-[83] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[10px_10px_0_#1e293b] w-full max-w-lg p-8 relative">
            {phase === 'pay-info' && (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
                    Come funziona
                  </p>
                  <h2 className="text-2xl font-black text-slate-900">
                    Con 5€ avrai 3 report a disposizione
                  </h2>
                  <p className="text-slate-500 text-sm mt-2">
                    Il primo sblocca subito questo report. Gli altri 2 restano sul tuo
                    profilo, pronti da usare quando vuoi su altre valutazioni.
                  </p>
                </div>

                {errorMsg && (
                  <div className="border-2 border-red-400 bg-red-50 rounded-xl p-3 text-red-700 text-sm">
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={startPayment}
                  disabled={isBusy}
                  className="bg-slate-900 text-white font-black rounded-full py-3 px-6 shadow-[4px_4px_0_#94a3b8] hover:shadow-[2px_2px_0_#94a3b8] active:shadow-none transition-all disabled:opacity-50"
                >
                  {isBusy ? 'Reindirizzamento…' : 'Prosegui e paga'}
                </button>
                <button onClick={() => setPhase('intro')} className="text-sm text-slate-400 underline">
                  Torna indietro
                </button>
              </div>
            )}

            {phase === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="animate-spin h-10 w-10 border-4 border-slate-900 border-t-transparent rounded-full" />
                <p className="text-slate-500 text-sm">Generazione report in corso…</p>
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  // Fase pre-lancio: feedback obbligatorio al posto di pagamento/video.
  if (inviteToken) {
    return (
      <div
        className={`bg-white border-2 border-slate-900 rounded-2xl shadow-[6px_6px_0_#1e293b] p-6 ${className}`}
      >
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
          Test pre-lancio
        </p>
        <h2 className="text-xl font-black text-slate-900 leading-tight">
          {feedbackDone ? 'Grazie! Il tuo report è in download.' : 'Com\'è andata questa valutazione?'}
        </h2>
        {!feedbackDone && (
          <p className="text-slate-500 text-sm mt-2">
            Lasciaci un feedback su questa prova (cosa ti è piaciuto, cosa ti ha confuso, cosa
            cambieresti) e scarica subito gratis il report completo in PDF.
          </p>
        )}

        {!feedbackDone ? (
          <>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              placeholder="Scrivi qui il tuo feedback..."
              className="w-full mt-4 border-2 border-slate-900 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {feedbackError && (
              <div className="mt-3 border-2 border-red-400 bg-red-50 rounded-xl p-3 text-red-700 text-sm">
                {feedbackError}
              </div>
            )}
            <button
              onClick={submitFeedbackAndDownload}
              disabled={feedbackBusy}
              className="w-full mt-4 bg-slate-900 text-white font-black rounded-full py-3 px-6 shadow-[4px_4px_0_#94a3b8] hover:shadow-[2px_2px_0_#94a3b8] active:shadow-none transition-all disabled:opacity-50"
            >
              {feedbackBusy ? 'Generazione report...' : 'Invia feedback e scarica il report'}
            </button>
          </>
        ) : (
          <p className="text-slate-500 text-sm mt-2">
            Grazie mille per il tuo aiuto in questa fase di test: se il download non è partito
            automaticamente, ricontrolla le notifiche del browser.
          </p>
        )}
      </div>
    )
  }

  // Fase "intro" — card sempre visibile in pagina, non una modale
  return (
    <div
      className={`bg-white border-2 border-slate-900 rounded-2xl shadow-[6px_6px_0_#1e293b] p-6 ${className}`}
    >
      <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
        Report completo — 5€
      </p>
      <h2 className="text-xl font-black text-slate-900 leading-tight">{pitch.title}</h2>
      <p className="text-slate-500 text-sm mt-2">{pitch.body}</p>

      {errorMsg && (
        <div className="mt-4 border-2 border-red-400 bg-red-50 rounded-xl p-3 text-red-700 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {session?.user && credits > 0 ? (
          <button
            onClick={unlockWithCredit}
            disabled={isBusy}
            className="w-full flex items-center gap-4 border-2 border-slate-900 rounded-2xl p-4 text-left hover:bg-slate-50 shadow-[4px_4px_0_#1e293b] hover:shadow-[2px_2px_0_#1e293b] active:shadow-none transition-all disabled:opacity-50"
          >
            <span className="text-2xl">🎁</span>
            <div className="flex-1">
              <p className="font-black text-slate-900 text-sm">
                Hai {credits} report disponibili
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {isBusy ? 'Sblocco in corso…' : 'Usa subito un credito per sbloccare questo report'}
              </p>
            </div>
            <span className="text-slate-400 text-lg">→</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => handleChoice('pay')}
              disabled={isBusy}
              className="w-full flex items-center gap-4 border-2 border-slate-900 rounded-2xl p-4 text-left hover:bg-slate-50 shadow-[4px_4px_0_#1e293b] hover:shadow-[2px_2px_0_#1e293b] active:shadow-none transition-all disabled:opacity-50"
            >
              <span className="text-2xl">💳</span>
              <div className="flex-1">
                <p className="font-black text-slate-900 text-sm">Sblocca il report — €5</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Ottieni 3 report a disposizione, utilizzabili anche su altre valutazioni
                </p>
              </div>
              <span className="text-slate-400 text-lg">→</span>
            </button>

            {videoAllowed && (
              <button
                onClick={() => handleChoice('video')}
                disabled={isBusy}
                className="w-full flex items-center gap-4 border-2 border-slate-300 rounded-2xl p-4 text-left hover:border-slate-900 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                <span className="text-2xl">📺</span>
                <div className="flex-1">
                  <p className="font-black text-slate-900 text-sm">Guarda un breve video</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Gratis — sblocchi subito questo report
                  </p>
                </div>
                <span className="text-slate-400 text-lg">→</span>
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center mt-4">
        Il report è generato in base ai dati OMI e alla tua valutazione.
      </p>
    </div>
  )
}

export default ReportSellModal
