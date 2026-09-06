import { useState, useEffect } from 'react'
import { authClient } from '../lib/auth-client'

interface ResetPasswordPageProps {
  onNavigate: (page: string) => void
  mode?: 'reset' | 'create'
}

export default function ResetPasswordPage({ onNavigate, mode = 'reset' }: ResetPasswordPageProps) {
  const isCreate = mode === 'create'
  const [token, setToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (!t) {
      setError('Link non valido o scaduto. Richiedi un nuovo link.')
    } else {
      setToken(t)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono.')
      return
    }
    if (newPassword.length < 8) {
      setError('La password deve essere di almeno 8 caratteri.')
      return
    }
    if (!token) return
    setIsSubmitting(true)
    try {
      const result = await authClient.resetPassword({ newPassword, token })
      if ((result as any)?.error) {
        setError((result as any).error.message || 'Link scaduto o non valido. Richiedi un nuovo link.')
        setStatus('error')
      } else {
        setStatus('done')
        window.history.replaceState({}, '', '/')
      }
    } catch {
      setError('Errore di connessione. Riprova.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[10px_10px_0_#1e293b] w-full max-w-md p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">
            {isCreate ? 'Account attivato' : 'Password aggiornata'}
          </h1>
          <p className="text-slate-600 text-sm mb-6">
            {isCreate
              ? 'La tua password è stata creata. Ora puoi accedere al tuo profilo personale con l\'email usata per il pagamento e la password appena scelta.'
              : 'La tua password è stata reimpostata correttamente. Ora puoi accedere con le nuove credenziali.'}
          </p>
          <button
            onClick={() => onNavigate('test_home')}
            className="bg-slate-900 text-white font-black rounded-full py-3 px-8 shadow-[4px_4px_0_#94a3b8] hover:shadow-[2px_2px_0_#94a3b8] active:shadow-none transition-all"
          >
            {isCreate ? 'Vai al login' : 'Vai alla home'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[10px_10px_0_#1e293b] w-full max-w-md p-8">
        <h1 className="text-2xl font-black text-slate-900 mb-2">
          {isCreate ? 'Crea la tua password' : 'Nuova password'}
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          {isCreate
            ? 'Il pagamento è andato a buon fine! Crea una password per accedere al tuo report e al tuo profilo personale.'
            : 'Scegli una nuova password per il tuo account.'}
        </p>

        {error && (
          <div className="border-2 border-red-500 bg-red-50 rounded-xl p-3 text-red-700 text-sm font-medium mb-4">
            {error}
            {status === 'error' && (
              <span
                role="button"
                tabIndex={0}
                className="block mt-2 font-bold underline cursor-pointer"
                onClick={() => onNavigate('test_home')}
                onKeyDown={e => e.key === 'Enter' && onNavigate('test_home')}
              >
                Torna alla home e richiedi un nuovo link
              </span>
            )}
          </div>
        )}

        {!error || status !== 'error' ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-slate-700" htmlFor="new-password">
                Nuova password
              </label>
              <input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="border-2 border-slate-900 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Minimo 8 caratteri"
                autoComplete="new-password"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-slate-700" htmlFor="confirm-password">
                Conferma password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="border-2 border-slate-900 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Ripeti la password"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !token}
              className="bg-slate-900 text-white font-black rounded-full py-3 px-6 shadow-[4px_4px_0_#94a3b8] hover:shadow-[2px_2px_0_#94a3b8] active:shadow-none transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Salvataggio…' : isCreate ? 'Crea password e continua' : 'Imposta nuova password'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
