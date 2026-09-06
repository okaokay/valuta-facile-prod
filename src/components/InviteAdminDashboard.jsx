import { useEffect, useState } from 'react'
import {
  fetchAdminInviteMaster,
  updateAdminInviteMaster,
  fetchAdminInviteCodes,
  createAdminInviteCode,
  updateAdminInviteCode,
  deleteAdminInviteCode,
  fetchAdminInviteFeedback
} from '../services/adminLeadsService'

/**
 * Pannello admin per la fase di pre-lancio: gestisce più codici invito
 * (uno per tester o gruppo), ognuno attivabile/disattivabile, e permette di
 * leggere i feedback ricevuti per singolo codice.
 */
function InviteAdminDashboard() {
  const [codes, setCodes] = useState([])
  const [masterEnabled, setMasterEnabled] = useState(true)
  const [masterBusy, setMasterBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)

  // Codice il cui riquadro feedback è aperto (null = nessuno)
  const [openFeedbackFor, setOpenFeedbackFor] = useState(null)
  const [feedbackByCode, setFeedbackByCode] = useState({})
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [masterData, codesData] = await Promise.all([
        fetchAdminInviteMaster(),
        fetchAdminInviteCodes()
      ])
      setMasterEnabled(!!masterData.enabled)
      setCodes(codesData.codes || [])
    } catch (e) {
      setError(e.message || 'Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleToggleMaster = async () => {
    setMasterBusy(true)
    setError('')
    try {
      const data = await updateAdminInviteMaster(!masterEnabled)
      setMasterEnabled(!!data.enabled)
    } catch (e) {
      setError(e.message || 'Errore nel cambio di stato')
    } finally {
      setMasterBusy(false)
    }
  }

  const handleCreate = async () => {
    if (!newCode.trim()) return
    setCreating(true)
    setError('')
    try {
      const data = await createAdminInviteCode({ code: newCode.trim(), label: newLabel.trim() })
      setCodes(data.codes || [])
      setNewCode('')
      setNewLabel('')
    } catch (e) {
      setError(e.message || 'Errore nella creazione del codice')
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (c) => {
    try {
      const data = await updateAdminInviteCode(c.id, { enabled: !c.enabled })
      setCodes(data.codes || [])
    } catch (e) {
      setError(e.message || 'Errore nell\'aggiornamento')
    }
  }

  const handleDelete = async (c) => {
    if (!window.confirm(`Eliminare il codice "${c.code}"? Chi lo ha già usato non perde l'accesso già ottenuto, ma il codice non sarà più utilizzabile per nuovi accessi.`)) {
      return
    }
    try {
      const data = await deleteAdminInviteCode(c.id)
      setCodes(data.codes || [])
    } catch (e) {
      setError(e.message || 'Errore nell\'eliminazione')
    }
  }

  const handleToggleFeedback = async (c) => {
    if (openFeedbackFor === c.code) {
      setOpenFeedbackFor(null)
      return
    }
    setOpenFeedbackFor(c.code)
    if (!feedbackByCode[c.code]) {
      setFeedbackLoading(true)
      try {
        const data = await fetchAdminInviteFeedback(c.code)
        setFeedbackByCode((prev) => ({ ...prev, [c.code]: data.feedback || [] }))
      } catch (e) {
        setError(e.message || 'Errore nel caricamento dei feedback')
      } finally {
        setFeedbackLoading(false)
      }
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Caricamento...</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Fase pre-lancio: codici invito</h2>
        <p className="text-sm text-slate-600">
          Puoi creare più codici (uno per tester o gruppo di tester). Ogni codice è condiviso e
          riutilizzabile da più persone, ma ognuna può completare una sola valutazione. Disattiva
          o elimina un codice quando non ti serve più.
        </p>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className={`border-2 rounded-2xl p-5 flex items-center justify-between gap-4 ${
        masterEnabled ? 'bg-white border-slate-900' : 'bg-slate-50 border-slate-300'
      }`}>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Fase pre-lancio attiva</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            {masterEnabled
              ? 'Chi apre il sito deve inserire un codice invito. Disattiva per aprire il sito a tutti, senza toccare i singoli codici qui sotto.'
              : 'Disattivata: il sito è navigabile e utilizzabile da tutti senza alcun codice, anche se sotto ci sono codici "Attivo".'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleMaster}
          disabled={masterBusy}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-60 ${
            masterEnabled ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-700'
          }`}
        >
          {masterBusy ? '...' : masterEnabled ? 'Attiva — disattiva ora' : 'Disattivata — riattiva'}
        </button>
      </div>

      <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Aggiungi un nuovo codice</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Codice (es. MAURIZIO2026)"
            className="flex-1 border-2 border-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Etichetta (facoltativa, es. nome tester)"
            className="flex-1 border-2 border-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newCode.trim()}
            className="rounded-xl px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm transition-colors whitespace-nowrap"
          >
            {creating ? 'Aggiungo...' : 'Aggiungi codice'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {codes.length === 0 ? (
          <div className="text-sm text-slate-500">Nessun codice creato finora.</div>
        ) : (
          codes.map((c) => (
            <div key={c.id} className="bg-white border-2 border-slate-900 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono font-bold text-slate-900">{c.code}</div>
                  {c.label && <div className="text-xs text-slate-500">{c.label}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggle(c)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      c.enabled ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {c.enabled ? 'Attivo' : 'Disattivo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    Elimina
                  </button>
                </div>
              </div>

              <div className="flex gap-6 mt-4 text-sm text-slate-600">
                <div><span className="font-bold text-slate-900">{c.redemptions}</span> accessi</div>
                <div><span className="font-bold text-slate-900">{c.completed}</span> valutazioni completate</div>
              </div>

              <button
                type="button"
                onClick={() => handleToggleFeedback(c)}
                className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
              >
                {openFeedbackFor === c.code ? 'Nascondi feedback' : 'Leggi i feedback di questo codice →'}
              </button>

              {openFeedbackFor === c.code && (
                <div className="mt-3 space-y-2">
                  {feedbackLoading && !feedbackByCode[c.code] ? (
                    <div className="text-xs text-slate-500">Caricamento feedback...</div>
                  ) : (feedbackByCode[c.code] || []).length === 0 ? (
                    <div className="text-xs text-slate-500">Nessun feedback ricevuto per questo codice.</div>
                  ) : (
                    (feedbackByCode[c.code] || []).map((f) => (
                      <div key={f.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-sm text-slate-800 whitespace-pre-wrap">{f.message}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {new Date(f.created_at).toLocaleString('it-IT')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default InviteAdminDashboard
