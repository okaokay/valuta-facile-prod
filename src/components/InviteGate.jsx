import { useState } from 'react'
import axios from 'axios'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
export const INVITE_TOKEN_STORAGE_KEY = 'valutatore_invite_token'

/**
 * Gate di accesso per la fase di pre-lancio: chiede un codice invito
 * condiviso, e se corretto genera un token monouso (salvato in
 * localStorage) che permette una sola valutazione. Dopo la convalida
 * mostra una modale di ringraziamento con un piccolo form di feedback,
 * poi lascia entrare nell'app tramite onUnlocked().
 */
function InviteGate({ onUnlocked, alreadyUsed = false }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const response = await axios.post(`${API_BASE_URL}/invite/redeem`, {
        code: code.trim()
      })
      const newToken = response.data?.token
      if (newToken) {
        window.localStorage.setItem(INVITE_TOKEN_STORAGE_KEY, newToken)
        setShowWelcome(true)
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Codice non valido. Controlla di averlo scritto correttamente.')
      } else if (err.response?.status === 400) {
        setError('La fase di test con invito non è al momento attiva.')
      } else {
        setError('Errore di connessione. Riprova tra poco.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    onUnlocked()
  }

  if (alreadyUsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white border-2 border-slate-900 rounded-3xl shadow-[8px_8px_0_rgba(15,23,42,1)] p-8 text-center">
          <div className="text-4xl mb-3">🙏</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Grazie, hai già completato la tua valutazione di prova!</h2>
          <p className="text-sm text-slate-600">
            In questa fase di test ogni persona può fare una sola valutazione. Grazie per il tempo che ci hai dedicato: il tuo aiuto è prezioso per migliorare Valuta Facile prima del lancio.
          </p>
        </div>
      </div>
    )
  }

  if (showWelcome) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white border-2 border-slate-900 rounded-3xl shadow-[8px_8px_0_rgba(15,23,42,1)] p-8">
          <div className="text-4xl mb-3 text-center">🎉</div>
          <h2 className="text-xl font-bold text-slate-900 mb-3 text-center">Grazie per la tua prova!</h2>
          <p className="text-sm text-slate-700 mb-4">
            Sei importante per noi: stai partecipando alla fase di test privata di Valuta Facile,
            prima del lancio ufficiale. La tua valutazione ci aiuta a capire cosa funziona e cosa
            possiamo migliorare.
          </p>
          <p className="text-sm text-slate-700 mb-4">
            Fai pure con calma la tua valutazione come faresti normalmente. Alla fine, quando vedrai
            la stima, ti chiederemo un breve feedback: in cambio riceverai subito gratis il report
            completo in PDF.
          </p>

          <button
            type="button"
            onClick={handleContinue}
            className="w-full rounded-2xl px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors"
          >
            Ho capito, inizia la valutazione
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="max-w-sm w-full bg-white border-2 border-slate-900 rounded-3xl shadow-[8px_8px_0_rgba(15,23,42,1)] p-8"
      >
        <h2 className="text-lg font-bold text-slate-900 mb-1 text-center">Accesso anteprima</h2>
        <p className="text-xs text-slate-600 mb-4 text-center">
          Valuta Facile è in fase di test privato. Inserisci il codice invito che ti è stato dato.
        </p>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Codice invito"
          autoFocus
          className="w-full text-center tracking-widest uppercase border-2 border-slate-900 rounded-2xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        {error && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
        >
          {loading ? 'Verifica in corso...' : 'Entra'}
        </button>
      </form>
    </div>
  )
}

export default InviteGate
