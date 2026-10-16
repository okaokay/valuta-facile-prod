import { useEffect, useState } from 'react'
import { authClient } from '../lib/auth-client'
import LoginForm from '../components/auth/LoginForm'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string || '').replace(/\/+$/, '') || 'http://localhost:4001/api'

const TARIFFA_LABELS: Record<string, string> = {
  cpm: 'CPM (per 1000 impression)',
  cpc: 'CPC (per click)',
  flat: 'Canone flat'
}

interface CampaignWithStats {
  id: number
  nome: string
  tipo: string
  stato: string
  stato_approvazione: string
  media_url: string | null
  media_pending_url: string | null
  cap_target: string
  raggio_km: number
  tariffa_tipo: string
  tariffa_valore: number
  stats: {
    impressions: number
    clicks: number
    ctr: number
    videoPlays: number
    videoCompletes: number
    timeseries: { giorno: string; impressions: number; clicks: number }[]
    perCap: { cap_utente: string; n: number }[]
  }
  importoMaturato: number
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0)
}

async function authorizedFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, credentials: 'include' })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || `Errore (${response.status})`)
  }
  return response.json()
}

function CampaignCard({ campaign, onUploaded }: { campaign: CampaignWithStats; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('media', file)
      await authorizedFetch(`/affiliate/campaigns/${campaign.id}/media`, {
        method: 'POST',
        body: formData
      })
      onUploaded()
    } catch (e: any) {
      setUploadError(e.message || "Errore nell'upload")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold text-slate-900">{campaign.nome}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {campaign.tipo} · CAP {campaign.cap_target} · raggio {campaign.raggio_km} km
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            campaign.stato === 'attiva' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {campaign.stato === 'attiva' ? 'Attiva' : 'In pausa'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-[11px] text-slate-500">Impression</div>
          <div className="text-lg font-bold text-slate-900">{campaign.stats.impressions}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-[11px] text-slate-500">Click</div>
          <div className="text-lg font-bold text-slate-900">{campaign.stats.clicks}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-[11px] text-slate-500">CTR</div>
          <div className="text-lg font-bold text-slate-900">{campaign.stats.ctr}%</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-[11px] text-slate-500">Maturato</div>
          <div className="text-lg font-bold text-slate-900">{formatEuro(campaign.importoMaturato)}</div>
        </div>
      </div>
      <div className="text-xs text-slate-500">
        Tariffa: {TARIFFA_LABELS[campaign.tariffa_tipo]} · {formatEuro(campaign.tariffa_valore)}
      </div>

      {campaign.stats.perCap.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">CAP dove è comparsa (top)</div>
          <div className="flex flex-wrap gap-1.5">
            {campaign.stats.perCap.slice(0, 10).map((c) => (
              <span key={c.cap_utente} className="text-[11px] bg-slate-100 rounded-full px-2 py-0.5">
                {c.cap_utente} · {c.n}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          {campaign.media_url ? (
            <a href={campaign.media_url} target="_blank" rel="noreferrer" className="text-blue-700 font-semibold hover:underline">
              Vedi materiale live →
            </a>
          ) : (
            <span className="text-amber-600 font-semibold">Nessun materiale live</span>
          )}
          {campaign.stato_approvazione === 'in_attesa' && (
            <div className="mt-1 text-amber-700">Nuovo file in attesa di approvazione da parte nostra.</div>
          )}
        </div>
        <label className="text-xs font-semibold text-slate-900 border-2 border-slate-900 rounded-full px-3 py-1.5 cursor-pointer hover:bg-slate-900 hover:text-white transition-colors">
          {uploading ? 'Carico...' : 'Carica nuovo file'}
          <input
            type="file"
            accept={campaign.tipo === 'video' ? 'video/*' : 'image/*'}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {uploadError && <div className="text-xs text-red-600">{uploadError}</div>}
    </div>
  )
}

export default function AffiliatePortalPage() {
  const { data: session, isPending } = authClient.useSession()
  const [status, setStatus] = useState<'loading' | 'not_affiliate' | 'ready' | 'error'>('loading')
  const [affiliate, setAffiliate] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([])
  const [overview, setOverview] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const load = async () => {
    setStatus('loading')
    try {
      const [meData, overviewData] = await Promise.all([
        authorizedFetch('/affiliate/me'),
        authorizedFetch('/affiliate/overview')
      ])
      setAffiliate(meData.affiliate)
      setCampaigns(meData.campaigns || [])
      setOverview(overviewData.overview)
      setStatus('ready')
    } catch (e: any) {
      if (e.message === 'not_an_affiliate' || e.message === 'affiliate_suspended') {
        setStatus('not_affiliate')
      } else {
        setErrorMessage(e.message || 'Errore nel caricamento')
        setStatus('error')
      }
    }
  }

  useEffect(() => {
    if (isPending) return
    if (!session?.user) {
      setStatus('loading')
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, session?.user?.id])

  if (isPending) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Caricamento...</div>
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm bg-white border-2 border-slate-900 rounded-2xl p-6 shadow-[6px_6px_0_rgba(15,23,42,1)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Portale affiliati</p>
          <LoginForm
            onSuccess={() => load()}
            onSwitchToRegister={() => {}}
            onForgotPassword={() => {}}
          />
        </div>
      </div>
    )
  }

  if (status === 'not_affiliate') {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Questo account non è registrato come affiliato</h1>
          <p className="mt-2 text-sm text-slate-600">
            Se pensi sia un errore, contatta chi ti ha invitato al programma di affiliazione.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return <div className="min-h-screen flex items-center justify-center text-sm text-red-600">{errorMessage}</div>
  }

  if (status === 'loading' || !affiliate) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Caricamento...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ciao, {affiliate.ragione_sociale}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Qui trovi l&apos;andamento di tutte le tue campagne pubblicitarie su Valuta Facile.
          </p>
        </div>

        {overview && (
          <div className="bg-white border-2 border-slate-900 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Totale di tutte le campagne</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-[11px] text-slate-500">Impression</div>
                <div className="text-xl font-bold text-slate-900">{overview.totals.impressions}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-[11px] text-slate-500">Click</div>
                <div className="text-xl font-bold text-slate-900">{overview.totals.clicks}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-[11px] text-slate-500">CTR</div>
                <div className="text-xl font-bold text-slate-900">{overview.totals.ctr}%</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-[11px] text-slate-500">Totale maturato</div>
                <div className="text-xl font-bold text-slate-900">
                  {formatEuro(campaigns.reduce((sum, c) => sum + (c.importoMaturato || 0), 0))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Le tue campagne</h2>
          {campaigns.length === 0 ? (
            <div className="text-sm text-slate-500">Non hai ancora nessuna campagna attiva.</div>
          ) : (
            campaigns.map((c) => <CampaignCard key={c.id} campaign={c} onUploaded={load} />)
          )}
        </div>
      </div>
    </div>
  )
}
