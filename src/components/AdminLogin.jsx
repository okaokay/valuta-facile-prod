import { useState } from 'react'
import {
  startAdminLogin,
  completeAdminLogin,
  setAdminToken
} from '../services/adminLeadsService'

function AdminLogin({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('credentials')
  const [pendingToken, setPendingToken] = useState('')
  const [otp, setOtp] = useState('')

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (step === 'credentials') {
        const data = await startAdminLogin({ username, password })
        if (data.token && !data.requireTotp) {
          setAdminToken(data.token)
          if (onSuccess) {
            onSuccess()
          }
          return
        }
        if (data.pendingToken && data.requireTotp) {
          setPendingToken(data.pendingToken)
          setStep('otp')
          setPassword('')
          return
        }
        throw new Error('Risposta login inattesa dal server')
      }

      if (step === 'otp') {
        await completeAdminLogin({ pendingToken, otp })
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (e) {
      setError(e.message || 'Errore durante il login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-3">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2"
            >
              <circle cx="16" cy="16" r="16" fill="#2563EB" />
              <path
                d="M16 6C10.48 6 6 10.48 6 16C6 21.52 10.48 26 16 26C21.52 26 26 21.52 26 16C26 10.48 21.52 6 16 6ZM16 24C11.59 24 8 20.41 8 16C8 11.59 11.59 8 16 8C20.41 8 24 11.59 24 16C24 20.41 20.41 24 16 24Z"
                fill="white"
              />
              <path d="M17 11H15V17H21V15H17V11Z" fill="white" />
            </svg>
            <div className="text-2xl font-bold text-blue-400">
              Valutatore Staff
            </div>
          </div>
          <div className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 inline-block">
            Accesso amministratore
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <div className="text-xs text-slate-400">
            {step === 'credentials'
              ? 'Inserisci le credenziali amministratore.'
              : 'Inserisci il codice a 6 cifre generato dalla tua app 2FA.'}
          </div>

          {step === 'credentials' && (
            <>
              <div>
                <label
                  htmlFor="admin-username"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Username
                </label>
                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {step === 'otp' && (
            <div>
              <label
                htmlFor="admin-otp"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Codice 2FA (OTP)
              </label>
              <input
                id="admin-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/60 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center items-center px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-sm font-medium text-white"
          >
            {loading
              ? 'Accesso in corso...'
              : step === 'credentials'
                ? 'Continua'
                : 'Verifica codice e accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminLogin
