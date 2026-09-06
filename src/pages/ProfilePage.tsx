import { useState, useEffect } from 'react'
import { authClient } from '../lib/auth-client'
import AdBanner from '../components/ads/AdBanner'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string || '').replace(/\/+$/, '') || 'http://localhost:4001/api'

interface Report {
  id: number
  lead_id: number | null
  report_path: string
  status: string
  created_at: string
}

interface Valuation {
  id: number
  created_at: string
  indirizzo: string
  valuation_data: string
}

type Tab = 'panoramica' | 'impostazioni'

export default function ProfilePage({ onNavigate, adMode }: { onNavigate: (page: string) => void; adMode?: string }) {
  const { data: session, isPending } = authClient.useSession()
  const [activeTab, setActiveTab] = useState<Tab>('panoramica')
  const [valuations, setValuations] = useState<Valuation[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reportCredits, setReportCredits] = useState<number | null>(null)
  const [isBuyingCredits, setIsBuyingCredits] = useState(false)

  // Name editing
  const [editName, setEditName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Newsletter
  const [newsletter, setNewsletter] = useState(false)
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'saving'>('idle')

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (isPending) return
    if (!session?.user) {
      onNavigate('test_home')
      return
    }

    setEditName(session.user.name || '')
    setDisplayName(session.user.name || '')

    // Se torniamo qui da Stripe (?session_id=...), il webhook potrebbe non essere
    // ancora arrivato (o, in sviluppo locale senza `stripe listen`, potrebbe non
    // arrivare mai). Verifichiamo subito lo stato del pagamento lato server prima
    // di caricare crediti/report, così l'utente li vede comparire senza dover
    // ricaricare la pagina. La chiamata è idempotente: se il webhook ha già fatto
    // tutto, questa è un no-op che restituisce solo il saldo aggiornato.
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    const confirmPayment = sessionId
      ? fetch(`${API_BASE}/payment/confirm-session?session_id=${encodeURIComponent(sessionId)}`, {
          credentials: 'include'
        })
          .then(async r => {
            const body = await r.json().catch(() => null)
            if (!r.ok) {
              console.error('[profilo] Conferma pagamento fallita:', r.status, body)
              return null
            }
            console.log('[profilo] Conferma pagamento:', body)
            return body
          })
          .catch(err => {
            console.error('[profilo] Errore rete durante conferma pagamento:', err)
            return null
          })
          .finally(() => {
            // Rimuoviamo session_id dall'URL per evitare di richiamare l'endpoint
            // ad ogni refresh della pagina.
            params.delete('session_id')
            const newSearch = params.toString()
            window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''))
          })
      : Promise.resolve(null)

    confirmPayment.then(() => {
      Promise.all([
        fetch(`${API_BASE}/profile/me`, { credentials: 'include' }).then(r => r.json()),
        fetch(`${API_BASE}/profile/reports`, { credentials: 'include' }).then(r => r.json()),
        fetch(`${API_BASE}/report/credits`, { credentials: 'include' }).then(r => r.json())
      ])
        .then(([profileData, reportsData, creditsData]) => {
          setValuations(profileData?.valuations || [])
          setReports(reportsData?.reports || [])
          setReportCredits(typeof creditsData?.balance === 'number' ? creditsData.balance : 0)
        })
        .catch(console.error)
        .finally(() => setIsLoading(false))
    })
  }, [session, isPending])

  async function handleBuyCredits() {
    setIsBuyingCredits(true)
    try {
      const res = await fetch(`${API_BASE}/payment/create-session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectTo: '/profilo' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore pagamento')
      window.location.href = data.url
    } catch {
      setIsBuyingCredits(false)
    }
  }

  if (isPending || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-slate-50">
        <div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!session?.user) return null

  const user = session.user as any

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault()
    setNameStatus('saving')
    try {
      const res = await fetch(`${API_BASE}/profile/update-name`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName })
      })
      if (res.ok) {
        setNameStatus('done')
        setDisplayName(editName)
      } else {
        setNameStatus('error')
      }
    } catch {
      setNameStatus('error')
    }
    setTimeout(() => setNameStatus('idle'), 3000)
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    if (newPassword !== confirmPassword) {
      setPasswordError('Le password non coincidono.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('La nuova password deve essere di almeno 8 caratteri.')
      return
    }
    setPasswordStatus('saving')
    try {
      const res = await fetch(`${API_BASE}/profile/update-password`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })
      if (res.ok) {
        setPasswordStatus('done')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => setPasswordStatus('idle'), 3000)
      } else {
        const data = await res.json()
        setPasswordError(data.error || 'Password attuale non corretta.')
        setPasswordStatus('idle')
      }
    } catch {
      setPasswordError('Errore di rete. Riprova.')
      setPasswordStatus('idle')
    }
  }

  async function handleNewsletterToggle(checked: boolean) {
    setNewsletter(checked)
    setNewsletterStatus('saving')
    try {
      await fetch(`${API_BASE}/profile/email-preferences`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsletter: checked })
      })
    } catch {}
    setNewsletterStatus('idle')
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    setIsDeleting(true)
    try {
      await fetch(`${API_BASE}/profile/delete`, { method: 'DELETE', credentials: 'include' })
      await authClient.signOut()
      onNavigate('test_home')
    } catch {
      setIsDeleting(false)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  function formatPrice(n: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  }

  const memberSince = user.createdAt ? formatDate(user.createdAt) : null
  const showBanner = adMode === 'banner'

  return (
    <div className="flex-1 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center text-xl font-black">
              {(displayName || user.name)?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-0.5">Area personale</p>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                Ciao, {(displayName || user.name)?.split(' ')[0] || 'utente'}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {user.email}
                {memberSince && <span className="text-slate-400"> · Membro da {memberSince}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('test_home')}
            className="text-sm text-slate-500 hover:text-slate-900 underline shrink-0 mt-1 hidden sm:inline"
          >
            ← Home
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-2 border-b-2 border-slate-200 mb-8">
          <button
            onClick={() => setActiveTab('panoramica')}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-lg border-b-2 -mb-0.5 transition-colors ${
              activeTab === 'panoramica'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Panoramica
          </button>
          <button
            onClick={() => setActiveTab('impostazioni')}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-lg border-b-2 -mb-0.5 transition-colors ${
              activeTab === 'impostazioni'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Impostazioni account
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),280px] gap-8 items-start">
          {/* Main column */}
          <div className="space-y-8 min-w-0">
            {activeTab === 'panoramica' && (
              <>
                {/* Riepilogo account */}
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0_#1e293b] p-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Report disponibili</p>
                    <p className="text-2xl font-black text-slate-900">{reportCredits ?? 0}</p>
                  </div>
                  <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0_#1e293b] p-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Report generati</p>
                    <p className="text-2xl font-black text-slate-900">{reports.length}</p>
                  </div>
                  <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0_#1e293b] p-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valutazioni fatte</p>
                    <p className="text-2xl font-black text-slate-900">{valuations.length}</p>
                  </div>
                </section>

                {/* Report */}
                <section className="bg-white border-2 border-slate-900 rounded-2xl shadow-[6px_6px_0_#1e293b] p-6">
                  <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                    <h2 className="text-lg font-black text-slate-900">I tuoi report PDF</h2>
                    {reportCredits !== null && (
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                            reportCredits > 0
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border border-slate-300'
                          }`}
                        >
                          {reportCredits > 0
                            ? `${reportCredits} report a disposizione`
                            : 'Nessun report a disposizione'}
                        </span>
                        <button
                          onClick={handleBuyCredits}
                          disabled={isBuyingCredits}
                          className="text-xs font-bold text-white bg-slate-900 px-3 py-1.5 rounded-full hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          {isBuyingCredits ? '…' : 'Compra 3 report — €5'}
                        </button>
                      </div>
                    )}
                  </div>
                  {reports.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-3">📄</p>
                      <p className="text-slate-500 text-sm">Nessun report ancora.</p>
                      <p className="text-slate-400 text-xs mt-1">Completa una valutazione e scegli come sbloccare il PDF.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reports.map(report => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-colors"
                        >
                          <div>
                            <p className="font-bold text-slate-900 text-sm">Report #{report.id}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(report.created_at)}</p>
                          </div>
                          <a
                            href={`${API_BASE}/profile/reports/${report.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-slate-700 transition-colors"
                          >
                            📥 Scarica PDF
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Valutazioni */}
                <section className="bg-white border-2 border-slate-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h2 className="text-lg font-black text-slate-900">Le tue valutazioni</h2>
                    <button
                      onClick={() => onNavigate('test_home')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      + Nuova valutazione
                    </button>
                  </div>
                  {valuations.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-3">🏠</p>
                      <p className="text-slate-500 text-sm">Non hai ancora fatto nessuna valutazione.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {valuations.map((val: any) => {
                        let prezzoMedio: number | null = null
                        let indirizzo = `Valutazione #${val.id}`
                        try {
                          const vd = val.valuation_data ? JSON.parse(val.valuation_data) : {}
                          prezzoMedio = vd?.valutazione?.prezzoMedio || vd?.prezzoMedio || null
                        } catch {}
                        try {
                          const sd = val.step_data ? JSON.parse(val.step_data) : {}
                          const addr = sd?.address?.display || sd?.address?.formatted || sd?.indirizzo
                          if (addr) indirizzo = addr
                        } catch {}
                        return (
                          <div
                            key={val.id}
                            className="flex items-center justify-between border border-slate-200 rounded-xl p-4"
                          >
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{indirizzo}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{formatDate(val.created_at)}</p>
                            </div>
                            {prezzoMedio && (
                              <p className="font-black text-indigo-600 text-sm shrink-0">
                                {formatPrice(prezzoMedio)}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* Banner pubblicitario mobile, solo se ad_mode = banner */}
                {showBanner && (
                  <div className="lg:hidden">
                    <AdBanner slotEnvVar="VITE_ADSENSE_SLOT_PROFILE" placeholderLabel="Spazio pubblicitario" />
                  </div>
                )}
              </>
            )}

            {activeTab === 'impostazioni' && (
              <section className="bg-white border-2 border-slate-200 rounded-2xl p-6 space-y-8">
                <h2 className="text-lg font-black text-slate-900">Impostazioni account</h2>

                {/* Modifica nome */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Nome visualizzato</h3>
                  <form onSubmit={handleUpdateName} className="flex gap-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-900 transition-colors"
                      placeholder="Il tuo nome"
                    />
                    <button
                      type="submit"
                      disabled={nameStatus === 'saving'}
                      className="bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50 min-w-[80px]"
                    >
                      {nameStatus === 'saving' ? '…' : nameStatus === 'done' ? '✓ Salvato' : 'Salva'}
                    </button>
                  </form>
                  {nameStatus === 'error' && <p className="text-red-600 text-xs mt-1">Errore nel salvataggio. Riprova.</p>}
                </div>

                {/* Cambia password */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Cambia password</h3>
                  <form onSubmit={handleUpdatePassword} className="space-y-3">
                    {passwordError && (
                      <div className="border border-red-300 bg-red-50 rounded-xl p-3 text-red-700 text-xs">
                        {passwordError}
                      </div>
                    )}
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-900 transition-colors"
                      placeholder="Password attuale"
                      autoComplete="current-password"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-900 transition-colors"
                      placeholder="Nuova password (min. 8 caratteri)"
                      autoComplete="new-password"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-900 transition-colors"
                      placeholder="Conferma nuova password"
                      autoComplete="new-password"
                    />
                    <button
                      type="submit"
                      disabled={passwordStatus === 'saving'}
                      className="bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      {passwordStatus === 'saving' ? 'Aggiornamento…' : passwordStatus === 'done' ? 'Password aggiornata ✓' : 'Aggiorna password'}
                    </button>
                  </form>
                </div>

                {/* Preferenze email */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Preferenze email</h3>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={newsletter}
                        onChange={e => handleNewsletterToggle(e.target.checked)}
                        disabled={newsletterStatus === 'saving'}
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${newsletter ? 'bg-slate-900' : 'bg-slate-300'}`} />
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${newsletter ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                      Ricevi aggiornamenti sul mercato immobiliare
                      {newsletterStatus === 'saving' && <span className="ml-2 text-slate-400 text-xs">Salvataggio…</span>}
                    </span>
                  </label>
                </div>

                {/* Logout */}
                <div className="border-t border-slate-200 pt-6">
                  <button
                    onClick={async () => {
                      await authClient.signOut()
                      onNavigate('test_home')
                    }}
                    className="text-sm text-slate-500 hover:text-slate-900 underline transition-colors"
                  >
                    Esci dall'account
                  </button>
                </div>

                {/* Elimina account */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-bold text-red-600 mb-2">Zona pericolosa</h3>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-sm text-red-500 underline hover:text-red-700 transition-colors"
                    >
                      Elimina il mio account
                    </button>
                  ) : (
                    <div className="border-2 border-red-300 rounded-xl p-5 space-y-4 bg-red-50">
                      <p className="text-sm font-bold text-red-700">Questa azione è irreversibile.</p>
                      <p className="text-xs text-slate-600">
                        Il tuo account e tutti i dati associati verranno eliminati definitivamente.
                        Digita <strong>DELETE</strong> per confermare.
                      </p>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={e => setDeleteConfirmText(e.target.value)}
                        className="w-full border-2 border-red-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-600 bg-white"
                        placeholder="DELETE"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                          className="bg-red-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40"
                        >
                          {isDeleting ? 'Eliminazione…' : 'Elimina definitivamente'}
                        </button>
                        <button
                          onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                          className="text-sm text-slate-500 underline hover:text-slate-700"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0_#1e293b] p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Serve aiuto?</p>
              <p className="text-sm text-slate-700 mb-3">
                Hai domande sulla tua valutazione o sui report acquistati?
              </p>
              <button
                onClick={() => onNavigate('support')}
                className="text-xs font-bold text-white bg-slate-900 px-4 py-2 rounded-full hover:bg-slate-700 transition-colors"
              >
                Centro assistenza
              </button>
            </div>
            {showBanner && (
              <div className="hidden lg:block">
                <AdBanner slotEnvVar="VITE_ADSENSE_SLOT_PROFILE" placeholderLabel="Spazio pubblicitario" />
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
