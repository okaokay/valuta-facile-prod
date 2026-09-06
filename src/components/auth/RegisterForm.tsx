import { useState } from 'react'
import { authClient } from '../../lib/auth-client'

interface RegisterFormProps {
  onSuccess: () => void
  onSwitchToLogin: () => void
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri.')
      return
    }
    setIsSubmitting(true)
    try {
      const result = await authClient.signUp.email({ name, email, password })
      if (result.error) {
        setError(result.error.message || 'Registrazione non riuscita.')
      } else {
        onSuccess()
      }
    } catch {
      setError('Errore di connessione. Riprova.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-2xl font-black text-slate-900">Crea account</h2>

      {error && (
        <div className="border-2 border-red-500 bg-red-50 rounded-xl p-3 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-slate-700" htmlFor="reg-name">
          Nome
        </label>
        <input
          id="reg-name"
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="border-2 border-slate-900 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="Mario Rossi"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-slate-700" htmlFor="reg-email">
          Email
        </label>
        <input
          id="reg-email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border-2 border-slate-900 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="nome@esempio.it"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-slate-700" htmlFor="reg-password">
          Password
        </label>
        <input
          id="reg-password"
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="border-2 border-slate-900 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="Min. 8 caratteri"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-slate-900 text-white font-black rounded-full py-3 px-6 shadow-[4px_4px_0_#94a3b8] hover:shadow-[2px_2px_0_#94a3b8] active:shadow-none transition-all disabled:opacity-50"
      >
        {isSubmitting ? 'Registrazione in corso…' : 'Registrati'}
      </button>

      <p className="text-sm text-slate-600 text-center">
        Hai già un account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-bold text-slate-900 underline"
        >
          Accedi
        </button>
      </p>
    </form>
  )
}
