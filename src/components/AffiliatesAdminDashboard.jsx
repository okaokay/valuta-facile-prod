import { useEffect, useState } from 'react'
import {
  fetchAdminAffiliates,
  createAdminAffiliate,
  fetchAdminAffiliateDetail,
  updateAdminAffiliate,
  deleteAdminAffiliate,
  fetchAdminAffiliateStats,
  createAdminCampaign,
  updateAdminCampaign,
  deleteAdminCampaign,
  uploadAdminCampaignMedia,
  approveAdminCampaignAsset,
  rejectAdminCampaignAsset
} from '../services/adminLeadsService'

const TARIFFA_LABELS = {
  cpm: 'CPM (per 1000 impression)',
  cpc: 'CPC (per click)',
  flat: 'Flat mensile'
}

const emptyAffiliateForm = { ragioneSociale: '', referente: '', email: '', telefono: '', note: '' }
const emptyCampaignForm = {
  nome: '',
  tipo: 'banner',
  linkDestinazione: '',
  capTarget: '',
  indirizzoTarget: '',
  raggioKm: 10,
  dataInizio: '',
  dataFine: '',
  tettoImpressioni: '',
  tariffaTipo: 'flat',
  tariffaValore: 0
}

/**
 * Pannello admin per gli affiliati che sponsorizzano banner/video mostrati
 * agli utenti in base alla vicinanza geografica (CAP/indirizzo + raggio) tra
 * il punto scelto per la campagna e l'immobile che l'utente sta valutando.
 * Qui l'admin crea l'affiliato, le sue campagne, carica il materiale e
 * approva/rifiuta gli upload self-service fatti dall'affiliato dal suo
 * portale (stato_approvazione).
 */
function AffiliatesAdminDashboard() {
  const [affiliates, setAffiliates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showNewAffiliate, setShowNewAffiliate] = useState(false)
  const [affiliateForm, setAffiliateForm] = useState(emptyAffiliateForm)
  const [creatingAffiliate, setCreatingAffiliate] = useState(false)

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [stats, setStats] = useState(null)

  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [campaignForm, setCampaignForm] = useState(emptyCampaignForm)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [uploadingFor, setUploadingFor] = useState(null)

  const loadList = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminAffiliates()
      setAffiliates(data.affiliates || [])
    } catch (e) {
      setError(e.message || 'Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [])

  const loadDetail = async (id) => {
    setDetailLoading(true)
    setError('')
    try {
      const [detailData, statsData] = await Promise.all([
        fetchAdminAffiliateDetail(id),
        fetchAdminAffiliateStats(id)
      ])
      setDetail(detailData)
      setStats(statsData.stats)
    } catch (e) {
      setError(e.message || 'Errore nel caricamento del dettaglio')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSelect = (id) => {
    setSelectedId(id)
    setShowNewCampaign(false)
    loadDetail(id)
  }

  const handleCreateAffiliate = async () => {
    if (!affiliateForm.ragioneSociale.trim() || !affiliateForm.email.trim()) return
    setCreatingAffiliate(true)
    setError('')
    try {
      await createAdminAffiliate(affiliateForm)
      setAffiliateForm(emptyAffiliateForm)
      setShowNewAffiliate(false)
      await loadList()
    } catch (e) {
      setError(e.message || 'Errore nella creazione')
    } finally {
      setCreatingAffiliate(false)
    }
  }

  const handleToggleStato = async (affiliate) => {
    try {
      await updateAdminAffiliate(affiliate.id, {
        stato: affiliate.stato === 'attivo' ? 'sospeso' : 'attivo'
      })
      await loadList()
      if (selectedId === affiliate.id) await loadDetail(affiliate.id)
    } catch (e) {
      setError(e.message || "Errore nell'aggiornamento")
    }
  }

  const handleDeleteAffiliate = async (affiliate) => {
    if (
      !window.confirm(
        `Eliminare "${affiliate.ragione_sociale}"? Verranno eliminate anche tutte le sue campagne e le statistiche raccolte.`
      )
    ) {
      return
    }
    try {
      await deleteAdminAffiliate(affiliate.id)
      if (selectedId === affiliate.id) {
        setSelectedId(null)
        setDetail(null)
      }
      await loadList()
    } catch (e) {
      setError(e.message || "Errore nell'eliminazione")
    }
  }

  const handleCreateCampaign = async () => {
    if (!campaignForm.nome.trim() || !campaignForm.capTarget.trim() || !selectedId) return
    setSavingCampaign(true)
    setError('')
    try {
      await createAdminCampaign(selectedId, campaignForm)
      setCampaignForm(emptyCampaignForm)
      setShowNewCampaign(false)
      await loadDetail(selectedId)
    } catch (e) {
      setError(e.message || 'Errore nella creazione della campagna')
    } finally {
      setSavingCampaign(false)
    }
  }

  const handleToggleCampaignStato = async (campaign) => {
    try {
      await updateAdminCampaign(campaign.id, {
        stato: campaign.stato === 'attiva' ? 'pausa' : 'attiva'
      })
      await loadDetail(selectedId)
    } catch (e) {
      setError(e.message || "Errore nell'aggiornamento della campagna")
    }
  }

  const handleDeleteCampaign = async (campaign) => {
    if (!window.confirm(`Eliminare la campagna "${campaign.nome}"?`)) return
    try {
      await deleteAdminCampaign(campaign.id)
      await loadDetail(selectedId)
    } catch (e) {
      setError(e.message || "Errore nell'eliminazione della campagna")
    }
  }

  const handleUploadMedia = async (campaign, file) => {
    if (!file) return
    setUploadingFor(campaign.id)
    setError('')
    try {
      await uploadAdminCampaignMedia(campaign.id, file)
      await loadDetail(selectedId)
    } catch (e) {
      setError(e.message || "Errore nell'upload del file")
    } finally {
      setUploadingFor(null)
    }
  }

  const handleApprove = async (campaign) => {
    try {
      await approveAdminCampaignAsset(campaign.id)
      await loadDetail(selectedId)
    } catch (e) {
      setError(e.message || "Errore nell'approvazione")
    }
  }

  const handleReject = async (campaign) => {
    try {
      await rejectAdminCampaignAsset(campaign.id)
      await loadDetail(selectedId)
    } catch (e) {
      setError(e.message || 'Errore nel rifiuto')
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Caricamento...</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Affiliati pubblicità</h2>
        <p className="text-sm text-slate-600">
          Ogni affiliato può avere più campagne (banner o video). Ogni campagna viene mostrata solo
          agli utenti che valutano un immobile entro il raggio in km impostato dal CAP/indirizzo
          scelto qui sotto. Se l&apos;affiliato carica da solo un nuovo file dal suo portale, resta
          &quot;in attesa&quot; finché non lo approvi.
        </p>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6 items-start">
        {/* Elenco affiliati */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowNewAffiliate((v) => !v)}
            className="w-full rounded-xl px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm"
          >
            {showNewAffiliate ? 'Annulla' : '+ Nuovo affiliato'}
          </button>

          {showNewAffiliate && (
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 space-y-2">
              <input
                type="text"
                placeholder="Ragione sociale *"
                value={affiliateForm.ragioneSociale}
                onChange={(e) => setAffiliateForm((p) => ({ ...p, ragioneSociale: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="Referente"
                value={affiliateForm.referente}
                onChange={(e) => setAffiliateForm((p) => ({ ...p, referente: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <input
                type="email"
                placeholder="Email *"
                value={affiliateForm.email}
                onChange={(e) => setAffiliateForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="Telefono"
                value={affiliateForm.telefono}
                onChange={(e) => setAffiliateForm((p) => ({ ...p, telefono: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <textarea
                placeholder="Note"
                value={affiliateForm.note}
                onChange={(e) => setAffiliateForm((p) => ({ ...p, note: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                rows={2}
              />
              <button
                type="button"
                onClick={handleCreateAffiliate}
                disabled={creatingAffiliate || !affiliateForm.ragioneSociale.trim() || !affiliateForm.email.trim()}
                className="w-full rounded-lg px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold"
              >
                {creatingAffiliate ? 'Creo...' : 'Crea affiliato'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {affiliates.length === 0 ? (
              <div className="text-sm text-slate-500">Nessun affiliato creato finora.</div>
            ) : (
              affiliates.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelect(a.id)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                    selectedId === a.id
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-900">{a.ragione_sociale}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        a.stato === 'attivo' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {a.stato}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{a.email}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {a.campagne_attive}/{a.campagne_totali} campagne attive
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Dettaglio affiliato selezionato */}
        <div>
          {!selectedId ? (
            <div className="text-sm text-slate-500 py-10 text-center">
              Seleziona un affiliato dall&apos;elenco per vedere le sue campagne e statistiche.
            </div>
          ) : detailLoading || !detail ? (
            <div className="text-sm text-slate-500">Caricamento...</div>
          ) : (
            <div className="space-y-5">
              <div className="bg-white border-2 border-slate-900 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{detail.affiliate.ragione_sociale}</h3>
                    <div className="text-sm text-slate-500">
                      {detail.affiliate.email} {detail.affiliate.telefono ? `· ${detail.affiliate.telefono}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStato(detail.affiliate)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        detail.affiliate.stato === 'attivo'
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {detail.affiliate.stato === 'attivo' ? 'Attivo' : 'Sospeso'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAffiliate(detail.affiliate)}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      Elimina
                    </button>
                  </div>
                </div>

                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500">Impression</div>
                      <div className="text-lg font-bold text-slate-900">{stats.totals.impressions}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500">Click</div>
                      <div className="text-lg font-bold text-slate-900">{stats.totals.clicks}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500">CTR</div>
                      <div className="text-lg font-bold text-slate-900">{stats.totals.ctr}%</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500">Play video</div>
                      <div className="text-lg font-bold text-slate-900">{stats.totals.videoPlays}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900">Campagne</h4>
                <button
                  type="button"
                  onClick={() => setShowNewCampaign((v) => !v)}
                  className="rounded-lg px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  {showNewCampaign ? 'Annulla' : '+ Nuova campagna'}
                </button>
              </div>

              {showNewCampaign && (
                <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 space-y-2">
                  <input
                    type="text"
                    placeholder="Nome campagna (es. Pescara centro - estate 2026) *"
                    value={campaignForm.nome}
                    onChange={(e) => setCampaignForm((p) => ({ ...p, nome: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={campaignForm.tipo}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, tipo: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="banner">Banner (immagine)</option>
                      <option value="video">Video</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Link destinazione al click"
                      value={campaignForm.linkDestinazione}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, linkDestinazione: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="CAP target * (es. 65126)"
                      value={campaignForm.capTarget}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, capTarget: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Indirizzo target (facoltativo, più preciso del solo CAP)"
                      value={campaignForm.indirizzoTarget}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, indirizzoTarget: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs text-slate-600 flex flex-col gap-1">
                      Raggio (km)
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={campaignForm.raggioKm}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, raggioKm: e.target.value }))}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-600 flex flex-col gap-1">
                      Data inizio
                      <input
                        type="date"
                        value={campaignForm.dataInizio}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, dataInizio: e.target.value }))}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-600 flex flex-col gap-1">
                      Data fine
                      <input
                        type="date"
                        value={campaignForm.dataFine}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, dataFine: e.target.value }))}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs text-slate-600 flex flex-col gap-1">
                      Tetto impressioni (opz.)
                      <input
                        type="number"
                        min="0"
                        value={campaignForm.tettoImpressioni}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, tettoImpressioni: e.target.value }))}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-600 flex flex-col gap-1">
                      Tariffa
                      <select
                        value={campaignForm.tariffaTipo}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, tariffaTipo: e.target.value }))}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      >
                        {Object.entries(TARIFFA_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-slate-600 flex flex-col gap-1">
                      Valore tariffa (€)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={campaignForm.tariffaValore}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, tariffaValore: e.target.value }))}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateCampaign}
                    disabled={savingCampaign || !campaignForm.nome.trim() || !campaignForm.capTarget.trim()}
                    className="w-full rounded-lg px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold"
                  >
                    {savingCampaign ? 'Salvo (geocodifico il CAP/indirizzo)...' : 'Crea campagna'}
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {(detail.campaigns || []).length === 0 ? (
                  <div className="text-sm text-slate-500">Nessuna campagna creata per questo affiliato.</div>
                ) : (
                  detail.campaigns.map((c) => (
                    <div key={c.id} className="bg-white border-2 border-slate-900 rounded-2xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm text-slate-900">
                            {c.nome} <span className="text-slate-400 font-normal">· {c.tipo}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {c.cap_target}
                            {c.indirizzo_target ? ` (${c.indirizzo_target})` : ''} · raggio {c.raggio_km} km
                            {c.target_lat === null && (
                              <span className="text-red-600 font-semibold"> · geocodifica non riuscita</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleCampaignStato(c)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              c.stato === 'attiva' ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {c.stato === 'attiva' ? 'Attiva' : 'In pausa'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCampaign(c)}
                            className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            Elimina
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {c.media_url ? (
                          <a
                            href={c.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            Vedi materiale live →
                          </a>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold">Nessun materiale caricato</span>
                        )}
                        <label className="text-xs font-semibold text-slate-700 cursor-pointer">
                          {uploadingFor === c.id ? 'Carico...' : c.media_url ? 'Sostituisci file' : 'Carica file'}
                          <input
                            type="file"
                            accept={c.tipo === 'video' ? 'video/*' : 'image/*'}
                            className="hidden"
                            onChange={(e) => handleUploadMedia(c, e.target.files?.[0])}
                          />
                        </label>
                      </div>

                      {c.stato_approvazione === 'in_attesa' && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                          <div className="text-xs text-amber-800">
                            L&apos;affiliato ha caricato un nuovo file dal suo portale, in attesa di approvazione.
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApprove(c)}
                              className="px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-white"
                            >
                              Approva
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(c)}
                              className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700"
                            >
                              Rifiuta
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 text-xs text-slate-500">
                        Tariffa: {TARIFFA_LABELS[c.tariffa_tipo]} · €{c.tariffa_valore}
                        {c.data_inizio || c.data_fine
                          ? ` · ${c.data_inizio || '…'} → ${c.data_fine || '…'}`
                          : ''}
                        {c.tetto_impressioni ? ` · tetto ${c.tetto_impressioni} impression` : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AffiliatesAdminDashboard
