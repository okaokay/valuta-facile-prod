import { useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string || '')
  .replace(/\/api\/?$/, '').replace(/\/+$/, '') || 'http://localhost:4001'

interface ForgotPasswordFormProps {
  onBack: () => void
}

export default function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const res = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, redirectTo })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as any)?.message || 'Errore durante la richiesta.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Errore di connessione. Riprova.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="text-5xl">📬</div>
        <h2 className="text-2xl font-black text-slate-900">Email inviata</h2>
        <p className="text-slate-600 text-sm">
          Se l'indirizzo <strong>{email}</strong> è registrato, riceverai un link per reimpostare la password.
          Controlla anche la cartella spam.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-bold text-slate-900 underline"
        >
          ← Torna al login
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-2xl font-black text-slate-900">Password dimenticata</h2>
      <p className="text-sm text-slate-600">
        Inserisci la tua email e ti invieremo un link per reimpostare la password.
      </p>

      {error && (
        <div className="border-2 border-red-500 bg-red-50 rounded-xl p-3 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-slate-700" htmlFor="forgot-email">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border-2 border-slate-900 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="nome@esempio.it"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-slate-900 text-white font-black rounded-full py-3 px-6 shadow-[4px_4px_0_#94a3b8] hover:shadow-[2px_2px_0_#94a3b8] active:shadow-none transition-all disabled:opacity-50"
      >
        {isSubmitting ? 'Invio in corso…' : 'Invia link di reset'}
      </button>

      <p className="text-sm text-slate-600 text-center">
        <button type="button" onClick={onBack} className="font-bold text-slate-900 underline">
          ← Torna al login
        </button>
      </p>
    </form>
  )
}
