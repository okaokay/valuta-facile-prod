import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import {
  fetchAdminLeads,
  fetchAdminLeadDetail,
  fetchProvinceAnalyticsSummary,
  fetchProvinceAnalyticsTimeseries
} from '../services/adminLeadsService'
import realOmiService from '../services/realOmiService'
import {
  PROFILE_TYPE_META,
  saleTimingOptions,
  buyerStageOptions,
  buyerFinancingOptions,
  buyerTimelineOptions,
  proRoleOptions,
  proPurposeOptions,
  proHasMandateOptions,
  labelFromOptions
} from './LeadQualificationWizard'

function ProfileTypeBadge({ profileType }) {
  const meta = PROFILE_TYPE_META[profileType]
  if (!meta) {
    return <span className="text-xs text-gray-400">-</span>
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${meta.color}`}
    >
      {meta.label}
    </span>
  )
}

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const PAGE_SIZE = 100

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function ContactsDashboard({ onClose, mode = 'overview', onGoToAutoGroups }) {
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [daysFilter, setDaysFilter] = useState(30)
  const [selectedContact, setSelectedContact] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [capFilter, setCapFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [mediaFilter, setMediaFilter] = useState('all')
  const [profileTypeFilter, setProfileTypeFilter] = useState('all')
  const [supportCategoryFilter, setSupportCategoryFilter] = useState('all')
  const [detailLead, setDetailLead] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [analyticsSummary, setAnalyticsSummary] = useState([])
  const [analyticsSeries, setAnalyticsSeries] = useState([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')
  const [analyticsGranularity, setAnalyticsGranularity] = useState('day')
  const [analyticsProvinceFilter, setAnalyticsProvinceFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [listTotal, setListTotal] = useState(0)
  const [listLimit, setListLimit] = useState(PAGE_SIZE)
  const [serverStats, setServerStats] = useState(null)

  const loadFromApi = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params = {
        page: currentPage,
        limit: PAGE_SIZE
      }
      if (daysFilter > 0) {
        const now = new Date()
        const from = new Date(
          now.getTime() - daysFilter * 24 * 60 * 60 * 1000
        )
        params.from = from.toISOString()
      }
      const data = await fetchAdminLeads(params)
      const mapped =
        data.items?.map(item => {
          let mediaMeta = null
          let aiMeta = null
          let property = {}
          let valuation = null
          let wizardData = null
          try {
            mediaMeta = item.media_meta ? JSON.parse(item.media_meta) : null
          } catch (e) {
            console.error('Errore nel parsing di media_meta admin leads', e)
          }
          try {
            aiMeta = item.ai_analysis_meta
              ? JSON.parse(item.ai_analysis_meta)
              : null
          } catch (e) {
            console.error('Errore nel parsing di ai_analysis_meta admin leads', e)
          }
          try {
            wizardData = item.step_data ? JSON.parse(item.step_data) : null
            if (wizardData && wizardData.property) {
              property = wizardData.property
            }
          } catch (e) {
            console.error('Errore nel parsing di step_data admin leads', e)
          }
          try {
            valuation = item.valuation_data
              ? JSON.parse(item.valuation_data)
              : null
          } catch (e) {
            console.error('Errore nel parsing di valuation_data admin leads', e)
          }
          const leadSource =
            wizardData?.lead?.source || wizardData?.lead?.profileType || null
          return {
            id: item.id,
            createdAt: item.created_at,
            contact: {
              nome: item.nome,
              cognome: item.cognome,
              email: item.email,
              telefono: item.telefono
            },
            address: {
              display: item.indirizzo,
              postcode: item.cap,
              city: item.citta
            },
            property,
            valuation,
            mediaMeta,
            aiMeta,
            wizardData,
            source: leadSource,
            raw: item
          }
        }) || []
      setContacts(mapped)

      const totalFromApi =
        typeof data.total === 'number' ? data.total : mapped.length
      const limitFromApi =
        typeof data.limit === 'number' && data.limit > 0
          ? data.limit
          : PAGE_SIZE
      setListTotal(totalFromApi)
      setListLimit(limitFromApi)

      if (data.stats) {
        const apiStats = data.stats
        const topCapFromApi = Array.isArray(apiStats.topCap)
          ? apiStats.topCap.map(row => [row.cap, row.count])
          : []
        setServerStats({
          total: apiStats.total || 0,
          last7: apiStats.last7 || 0,
          lastContactDate: apiStats.lastContactDate
            ? new Date(apiStats.lastContactDate)
            : null,
          topCap: topCapFromApi
        })
      } else {
        setServerStats(null)
      }
    } catch (e) {
      console.error('Errore caricamento lead admin:', e)
      setError(e.message || 'Errore nel caricamento dei lead')
      setContacts([])
      setServerStats(null)
    } finally {
      setLoading(false)
    }
  }, [daysFilter, currentPage])

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true)
      setAnalyticsError('')
      const now = new Date()
      const from = new Date(
        now.getTime() - daysFilter * 24 * 60 * 60 * 1000
      ).toISOString()
      const summaryResp = await fetchProvinceAnalyticsSummary({
        from,
        to: now.toISOString(),
        provinceSlug: analyticsProvinceFilter || undefined
      })
      const seriesResp = await fetchProvinceAnalyticsTimeseries({
        from,
        to: now.toISOString(),
        provinceSlug: analyticsProvinceFilter || undefined,
        granularity: analyticsGranularity
      })
      setAnalyticsSummary(summaryResp.items || [])
      setAnalyticsSeries(seriesResp.items || [])
    } catch (e) {
      setAnalyticsError(
        e.message || 'Errore nel caricamento delle statistiche di provincia'
      )
      setAnalyticsSummary([])
      setAnalyticsSeries([])
    } finally {
      setAnalyticsLoading(false)
    }
  }, [daysFilter, analyticsGranularity, analyticsProvinceFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [daysFilter])

  const refresh = () => {
    loadFromApi()
  }

  useEffect(() => {
    loadFromApi()
  }, [loadFromApi])

  useEffect(() => {
    if (mode === 'analytics') {
      loadAnalytics()
    }
  }, [mode, loadAnalytics])

  const loadLeadDetail = async contact => {
    if (!contact || !contact.id) return
    setDetailError('')
    setDetailLoading(true)
    setDetailLead(null)
    try {
      const data = await fetchAdminLeadDetail(contact.id)
      let wizardData = null
      let property = contact.property || {}
      let valuation = contact.valuation || null
      try {
        wizardData = data.lead?.step_data ? JSON.parse(data.lead.step_data) : null
      } catch (e) {
        console.error('Errore nel parsing di step_data admin lead', e)
      }
      if (!property && wizardData && wizardData.property) {
        property = wizardData.property
      }
      try {
        if (!valuation && data.lead?.valuation_data) {
          valuation = JSON.parse(data.lead.valuation_data)
        }
      } catch (e) {
        console.error('Errore nel parsing di valuation_data admin lead', e)
      }
      const mediaFiles = (data.media || []).map(item => ({
        ...item,
        url: API_BASE_URL ? `${API_BASE_URL}${item.file_url}` : item.file_url
      }))
      const aiRecords = (data.ai || []).map(item => {
        let summary = null
        let extracted = null
        try {
          summary = item.summary ? JSON.parse(item.summary) : null
        } catch (e) {
          console.error('Errore nel parsing di ai.summary admin lead', e)
        }
        try {
          extracted = item.extracted_features
            ? JSON.parse(item.extracted_features)
            : null
        } catch (e) {
          console.error('Errore nel parsing di ai.extracted_features admin lead', e)
        }
        return {
          ...item,
          summary,
          extracted_features: extracted
        }
      })
      setDetailLead({
        id: data.lead.id,
        createdAt: data.lead.created_at,
        contact: contact.contact,
        address: contact.address,
        property,
        valuation,
        wizardData,
        mediaFiles,
        aiRecords
      })
    } catch (e) {
      setDetailError(
        e.message || 'Errore nel caricamento della scheda completa del contatto'
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const filteredContacts = useMemo(() => {
    const now = new Date()
    const minDate =
      daysFilter > 0
        ? new Date(now.getTime() - daysFilter * 24 * 60 * 60 * 1000)
        : null

    return contacts.filter(c => {
      if (!c) return false

      if (minDate && c.createdAt) {
        const created = new Date(c.createdAt)
        if (!Number.isNaN(created.getTime()) && created < minDate) {
          return false
        }
      }

      if (capFilter.trim()) {
        const cap = (c.address?.postcode || '').toLowerCase()
        if (!cap.includes(capFilter.trim().toLowerCase())) {
          return false
        }
      }

      if (cityFilter.trim()) {
        const city = (c.address?.city || '').toLowerCase()
        if (!city.includes(cityFilter.trim().toLowerCase())) {
          return false
        }
      }

      if (mediaFilter === 'floorplan' && !c.mediaMeta?.hasFloorplan) {
        return false
      }
      if (
        mediaFilter === 'photos' &&
        !(
          typeof c.mediaMeta?.photosCount === 'number' &&
          c.mediaMeta.photosCount > 0
        )
      ) {
        return false
      }
      if (mediaFilter === 'ai' && !c.aiMeta) {
        return false
      }
      if (mediaFilter === 'with-media') {
        const hasFloorplan = c.mediaMeta?.hasFloorplan
        const hasPhotos =
          typeof c.mediaMeta?.photosCount === 'number' &&
          c.mediaMeta.photosCount > 0
        if (!hasFloorplan && !hasPhotos) {
          return false
        }
      }

      if (
        profileTypeFilter !== 'all' &&
        c.wizardData?.lead?.profileType !== profileTypeFilter
      ) {
        return false
      }

      if (!search.trim()) return true

      const q = search.toLowerCase()
      const parts = [
        c.contact?.nome,
        c.contact?.cognome,
        c.contact?.email,
        c.contact?.telefono,
        c.address?.city,
        c.address?.state,
        c.address?.postcode,
        c.address?.display
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return parts.includes(q)
    })
  }, [contacts, search, daysFilter, capFilter, cityFilter, mediaFilter, profileTypeFilter])

  const contactsFromContactPage = useMemo(
    () =>
      contacts.filter(
        c =>
          c && c.source && String(c.source).toLowerCase() === 'contact-page'
      ),
    [contacts]
  )

  const contactsFromNewsletter = useMemo(
    () =>
      contacts.filter(
        c =>
          c && c.source && String(c.source).toLowerCase() === 'newsletter'
      ),
    [contacts]
  )

  const contactsFromSupport = useMemo(
    () => {
      const base = contacts.filter(
        c => c && c.source && String(c.source).toLowerCase() === 'support'
      )

      if (supportCategoryFilter === 'all') {
        return base
      }

      return base.filter(c => {
        const category = c.wizardData?.lead?.supportCategory || 'Generale'
        return category === supportCategoryFilter
      })
    },
    [contacts, supportCategoryFilter]
  )

  const stats = useMemo(() => {
    const totalLocal = contacts.length
    const now = new Date()
    const last7Min = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    let last7Local = 0
    let lastContactDateLocal = null
    const byCapLocal = new Map()

    contacts.forEach(c => {
      if (!c) return
      const created = c.createdAt ? new Date(c.createdAt) : null

      if (created && !Number.isNaN(created.getTime())) {
        if (created >= last7Min) last7Local += 1
        if (!lastContactDateLocal || created > lastContactDateLocal) {
          lastContactDateLocal = created
        }
      }

      const cap = c.address?.postcode || 'N/D'
      byCapLocal.set(cap, (byCapLocal.get(cap) || 0) + 1)
    })

    const topCapLocal = [...byCapLocal.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    if (serverStats) {
      return {
        total:
          typeof serverStats.total === 'number'
            ? serverStats.total
            : totalLocal,
        last7:
          typeof serverStats.last7 === 'number'
            ? serverStats.last7
            : last7Local,
        lastContactDate: serverStats.lastContactDate || lastContactDateLocal,
        topCap:
          serverStats.topCap && serverStats.topCap.length > 0
            ? serverStats.topCap
            : topCapLocal
      }
    }

    return {
      total: totalLocal,
      last7: last7Local,
      lastContactDate: lastContactDateLocal,
      topCap: topCapLocal
    }
  }, [contacts, serverStats])

  const totalPages = useMemo(() => {
    if (!listLimit || listLimit <= 0) return 1
    const pages = Math.ceil(listTotal / listLimit)
    return pages > 0 ? pages : 1
  }, [listTotal, listLimit])

  const canGoPrevPage = currentPage > 1
  const canGoNextPage = currentPage < totalPages

  const autoGroupsSummary = useMemo(() => {
    if (!contacts || contacts.length === 0) {
      return {
        totalGroups: 0,
        totalGroupedContacts: 0,
        totalContacts: 0,
        groupedPercent: 0,
        capCountWithGroups: 0,
        capsTop: []
      }
    }

    const byCap = new Map()

    contacts.forEach(c => {
      if (!c) return
      const capRaw = (c.address?.postcode || 'N/D').trim()
      const cap = capRaw || 'N/D'
      if (!byCap.has(cap)) {
        byCap.set(cap, { count: 0 })
      }
      byCap.get(cap).count += 1
    })

    const capInfoCache = new Map()
    const caps = []

    byCap.forEach((entry, cap) => {
      const groups = Math.floor(entry.count / 5)
      const remainder = entry.count % 5

      let region = null
      let province = null
      let city = null

      if (groups > 0 && cap !== 'N/D') {
        let info = capInfoCache.get(cap)
        if (!info) {
          try {
            info = realOmiService.getCAPInfo(cap)
          } catch (e) {
            info = null
          }
          capInfoCache.set(cap, info)
        }
        if (info) {
          region = info.regione || null
          province = info.provincia || null
          city = info.comune || null
        }
      }

      caps.push({
        cap,
        contacts: entry.count,
        groups,
        remainder,
        region,
        province,
        city
      })
    })

    const totalGroups = caps.reduce((acc, c) => acc + c.groups, 0)
    const totalGroupedContacts = totalGroups * 5
    const totalContacts = contacts.length
    const groupedPercent =
      totalContacts > 0
        ? Math.round((totalGroupedContacts / totalContacts) * 100)
        : 0

    const capsWithGroups = caps.filter(c => c.groups > 0)
    capsWithGroups.sort((a, b) => {
      if (b.groups !== a.groups) return b.groups - a.groups
      return b.contacts - a.contacts
    })

    return {
      totalGroups,
      totalGroupedContacts,
      totalContacts,
      groupedPercent,
      capCountWithGroups: capsWithGroups.length,
      capsTop: capsWithGroups.slice(0, 5)
    }
  }, [contacts])

  const barData = useMemo(() => {
    const now = new Date()
    const days = []

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit'
      })
      days.push({ key, label, count: 0 })
    }

    contacts.forEach(c => {
      if (!c.createdAt) return
      const created = new Date(c.createdAt)
      if (Number.isNaN(created.getTime())) return
      const key = created.toISOString().slice(0, 10)
      const day = days.find(d => d.key === key)
      if (day) day.count += 1
    })

    return {
      labels: days.map(d => d.label),
      datasets: [
        {
          label: 'Contatti per giorno (ultimi 7 giorni)',
          data: days.map(d => d.count),
          backgroundColor: 'rgba(34, 197, 94, 0.6)',
          borderRadius: 6
        }
      ]
    }
  }, [contacts])

  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: context => `Contatti: ${context.parsed.y}`
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  }

  const analyticsSeriesData = useMemo(() => {
    if (!analyticsSeries || analyticsSeries.length === 0) {
      return null
    }
    const byBucket = new Map()
    analyticsSeries.forEach(row => {
      const key = row.bucket
      if (!byBucket.has(key)) {
        byBucket.set(key, 0)
      }
      byBucket.set(key, byBucket.get(key) + row.pageviews)
    })
    const buckets = Array.from(byBucket.keys()).sort()
    return {
      labels: buckets,
      datasets: [
        {
          label: 'Visite landing province',
          data: buckets.map(b => byBucket.get(b) || 0),
          backgroundColor: 'rgba(79, 70, 229, 0.8)',
          borderRadius: 6
        }
      ]
    }
  }, [analyticsSeries])

  let valuationContent = null

  if (selectedContact?.valuation?.valutazione) {
    valuationContent = (
      <>
        <div>
          Range:{' '}
          {selectedContact.valuation.valutazione.prezzoMinimo.toLocaleString(
            'it-IT',
            { style: 'currency', currency: 'EUR' }
          )}{' '}
          -{' '}
          {selectedContact.valuation.valutazione.prezzoMassimo.toLocaleString(
            'it-IT',
            { style: 'currency', currency: 'EUR' }
          )}
        </div>
        <div>
          Prezzo medio:{' '}
          {selectedContact.valuation.valutazione.prezzoMedio.toLocaleString(
            'it-IT',
            { style: 'currency', currency: 'EUR' }
          )}
        </div>
        <div>
          €/mq:{' '}
          {selectedContact.valuation.valutazione.prezzoAlMetroQuadro.toLocaleString(
            'it-IT',
            { maximumFractionDigits: 0 }
          )}
        </div>
      </>
    )
  } else if (selectedContact?.valuation?.totalValue) {
    valuationContent = (
      <>
        <div>
          Range:{' '}
          {selectedContact.valuation.minValue.toLocaleString('it-IT', {
            style: 'currency',
            currency: 'EUR'
          })}{' '}
          -{' '}
          {selectedContact.valuation.maxValue.toLocaleString('it-IT', {
            style: 'currency',
            currency: 'EUR'
          })}
        </div>
        <div>
          Valore stimato:{' '}
          {selectedContact.valuation.totalValue.toLocaleString('it-IT', {
            style: 'currency',
            currency: 'EUR'
          })}
        </div>
        <div>
          €/mq:{' '}
          {selectedContact.valuation.pricePerSqm.toLocaleString('it-IT', {
            maximumFractionDigits: 0
          })}
        </div>
      </>
    )
  } else if (selectedContact) {
    valuationContent = <div>Dati valutazione non disponibili.</div>
  }

  if (mode === 'analytics') {
    return (
      <div className="space-y-6 max-w-6xl mx-auto w-full px-2 sm:px-0">
        {analyticsError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            {analyticsError}
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Statistiche landing province
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Panoramica aggregata sulle visite delle landing per provincia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={daysFilter}
              onChange={e => setDaysFilter(Number(e.target.value))}
              className="bg-white text-xs sm:text-sm text-slate-900 h-9 px-3 rounded-xl border-2 border-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900 appearance-none"
            >
              <option value={7}>Ultimi 7 giorni</option>
              <option value={30}>Ultimi 30 giorni</option>
              <option value={90}>Ultimi 90 giorni</option>
            </select>
            <select
              value={analyticsGranularity}
              onChange={e => setAnalyticsGranularity(e.target.value)}
              className="bg-white text-xs sm:text-sm text-slate-900 h-9 px-3 rounded-xl border-2 border-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900 appearance-none"
            >
              <option value="day">Giorno</option>
              <option value="week">Settimana</option>
              <option value="month">Mese</option>
            </select>
            <input
              type="text"
              placeholder="Filtra provincia (slug)"
              value={analyticsProvinceFilter}
              onChange={e => setAnalyticsProvinceFilter(e.target.value)}
              className="w-36 rounded-md bg-white border border-gray-300 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
            />
            <button
              onClick={loadAnalytics}
              className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              {analyticsLoading ? 'Caricamento...' : 'Aggiorna'}
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center px-3 py-2 rounded-md border border-red-100 bg-red-50 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Torna all&apos;app utente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Andamento visite
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Totale visite landing province per intervallo selezionato.
                </p>
              </div>
            </div>
            <div className="mt-4 h-64">
              {analyticsSeriesData ? (
                <Bar data={analyticsSeriesData} options={barOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-500">
                  Nessun dato disponibile per l&apos;intervallo selezionato.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">
              Visite per provincia
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Distribuzione delle visite aggregate per provincia.
            </p>
            <div className="mt-4">
              {analyticsSummary.length === 0 && (
                <div className="text-xs text-gray-500">
                  Nessun dato disponibile.
                </div>
              )}
              {analyticsSummary.length > 0 && (
                <div className="space-y-2">
                  {analyticsSummary.map(item => (
                    <div
                      key={item.province_slug}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">
                          {item.province_slug}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Visite: {item.pageviews} · Sessioni:{' '}
                          {item.sessions} · Utenti:{' '}
                          {item.unique_visitors}
                        </span>
                      </div>
                      <div className="text-right text-[11px] text-gray-500">
                        {item.avg_duration_ms
                          ? `${Math.round(
                              item.avg_duration_ms / 1000
                            )}s`
                          : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'sources') {
    return (
      <div className="space-y-6 max-w-6xl mx-auto w-full px-2 sm:px-0">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Contatti da pagina e newsletter
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Vista dedicata alle richieste arrivate dalla pagina contatti e alle
              iscrizioni alla newsletter.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={daysFilter}
              onChange={e => setDaysFilter(Number(e.target.value))}
              className="bg-white text-xs sm:text-sm text-slate-900 h-9 px-3 rounded-xl border-2 border-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900 appearance-none"
            >
              <option value={7}>Ultimi 7 giorni</option>
              <option value={30}>Ultimi 30 giorni</option>
              <option value={90}>Ultimi 90 giorni</option>
              <option value={0}>Tutti i contatti</option>
            </select>
            <button
              onClick={refresh}
              className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              {loading ? 'Aggiornamento...' : 'Aggiorna dati'}
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center px-3 py-2 rounded-md border border-red-100 bg-red-50 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Torna all&apos;app utente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Richieste da pagina contatti
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Lead creati tramite la pagina /contatti.
                </p>
              </div>
              <div className="text-xs text-gray-500">
                Totali: {contactsFromContactPage.length}
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Nome
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Contatti
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {contactsFromContactPage.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-4 text-center text-[11px] text-gray-500"
                        >
                          Nessuna richiesta trovata dalla pagina contatti.
                        </td>
                      </tr>
                    )}
                    {contactsFromContactPage.map(c => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 text-gray-900">
                          {c.contact?.nome} {c.contact?.cognome}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          <div>{c.contact?.email}</div>
                          <div className="text-[11px] text-gray-400">
                            {c.contact?.telefono}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                          {formatDate(c.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Iscrizioni newsletter
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Email raccolte tramite il blocco newsletter in homepage.
                </p>
              </div>
              <div className="text-xs text-gray-500">
                Totali: {contactsFromNewsletter.length}
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Email
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Nome
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {contactsFromNewsletter.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-4 text-center text-[11px] text-gray-500"
                        >
                          Nessuna iscrizione newsletter registrata.
                        </td>
                      </tr>
                    )}
                    {contactsFromNewsletter.map(c => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 text-gray-900">
                          {c.contact?.email || '-'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {c.contact?.nome} {c.contact?.cognome}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                          {formatDate(c.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Richieste assistenza
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Ticket aperti dal Centro assistenza (/centro-assistenza).
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  Totali: {contactsFromSupport.length}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-gray-500">
                  Filtra per categoria:
                </label>
                <select
                  value={supportCategoryFilter}
                  onChange={e => setSupportCategoryFilter(e.target.value)}
                  className="bg-white text-xs text-slate-900 h-8 px-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-0 focus:border-slate-900"
                >
                  <option value="all">Tutte</option>
                  <option value="technical">Problemi tecnici</option>
                  <option value="account">Accesso e account</option>
                  <option value="privacy">Privacy e dati</option>
                  <option value="integration">Integrazioni e uso avanzato</option>
                  <option value="other">Altro</option>
                  <option value="Generale">Generale</option>
                </select>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Categoria
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Contatto
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Estratto richiesta
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {contactsFromSupport.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4 text-center text-[11px] text-gray-500"
                        >
                          Nessuna richiesta di assistenza registrata.
                        </td>
                      </tr>
                    )}
                    {contactsFromSupport.map(c => {
                      const supportCategory =
                        c.wizardData?.lead?.supportCategory || 'Generale'
                      const supportMessage =
                        c.wizardData?.lead?.supportMessage || ''
                      const shortMessage =
                        supportMessage.length > 80
                          ? `${supportMessage.slice(0, 77)}...`
                          : supportMessage

                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedContact(c)}
                          className="cursor-pointer hover:bg-gray-50"
                        >
                          <td className="px-3 py-2 text-gray-900">
                            {supportCategory}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            <div>{c.contact?.email}</div>
                            <div className="text-[11px] text-gray-400">
                              {c.contact?.nome} {c.contact?.cognome}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {shortMessage || '-'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {formatDate(c.createdAt)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full px-2 sm:px-0">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
            {mode === 'contactsOnly' ? 'Gestione contatti' : 'Dashboard Contatti'}
          </h1>
          {mode !== 'contactsOnly' && (
            <p className="text-sm text-gray-500 mt-1">
              Area riservata allo staff del Valutatore per monitorare lead e
              performance.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={daysFilter}
            onChange={e => setDaysFilter(Number(e.target.value))}
            className="bg-white text-xs sm:text-sm text-slate-900 h-9 px-3 rounded-xl border-2 border-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900 appearance-none"
          >
            <option value={7}>Ultimi 7 giorni</option>
            <option value={30}>Ultimi 30 giorni</option>
            <option value={90}>Ultimi 90 giorni</option>
            <option value={0}>Tutti i contatti</option>
          </select>
          <button
            onClick={refresh}
            className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            {loading ? 'Aggiornamento...' : 'Aggiorna dati'}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center px-3 py-2 rounded-md border border-red-100 bg-red-50 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            Torna all&apos;app utente
          </button>
        </div>
      </div>

      {mode !== 'contactsOnly' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase">
                Contatti totali
              </div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {stats.total}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Lead raccolti complessivamente
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase">
                Ultimi 7 giorni
              </div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {stats.last7}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Contatti negli ultimi 7 giorni
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase">
                Ultimo contatto
              </div>
              <div className="mt-2 text-sm font-medium text-gray-900">
                {stats.lastContactDate
                  ? formatDate(stats.lastContactDate.toISOString())
                  : 'Nessun contatto'}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Data e ora dell&apos;ultimo lead ricevuto
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Andamento contatti
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Distribuzione giornaliera degli ultimi 7 giorni
                  </p>
                </div>
              </div>
              <div className="mt-4 h-64">
                <Bar data={barData} options={barOptions} />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">
                Top CAP per numero di contatti
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                I CAP con il maggior numero di richieste.
              </p>
              <div className="mt-4 space-y-2">
                {stats.topCap.length === 0 && (
                  <div className="text-xs text-gray-500">
                    Nessun dato disponibile.
                  </div>
                )}
                {stats.topCap.map(([cap, count]) => (
                  <div
                    key={cap}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-700">
                        {cap}
                      </span>
                      <span className="text-gray-900">CAP {cap}</span>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium">
                      {count} contatti
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Raggruppamento automatico
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Panorama dei gruppi automatici da 5 contatti per CAP.
                </p>
              </div>
              {typeof onGoToAutoGroups === 'function' && (
                <button
                  type="button"
                  onClick={onGoToAutoGroups}
                  className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  Vai al dettaglio gruppi
                </button>
              )}
            </div>
            {autoGroupsSummary.totalGroups === 0 ? (
              <div className="text-xs text-gray-500">
                Nessun gruppo automatico disponibile. I gruppi vengono creati
                quando ci sono almeno 5 contatti con lo stesso CAP.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-[11px] font-medium text-gray-500 uppercase">
                      Gruppi automatici
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {autoGroupsSummary.totalGroups}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Blocchi da 5 contatti disponibili
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-gray-500 uppercase">
                      Contatti raggruppati
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {autoGroupsSummary.totalGroupedContacts}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Su {autoGroupsSummary.totalContacts} contatti totali
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-gray-500 uppercase">
                      Copertura
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {autoGroupsSummary.groupedPercent}%
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Contatti già pronti per vendita in blocco
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-gray-500 uppercase">
                      CAP con gruppi
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {autoGroupsSummary.capCountWithGroups}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      CAP che hanno almeno un gruppo
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">
                    CAP con più gruppi automatici
                  </h3>
                  <div className="space-y-2">
                    {autoGroupsSummary.capsTop.map(capItem => (
                      <div
                        key={capItem.cap}
                        className="flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            CAP {capItem.cap}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {capItem.city || ''}
                            {capItem.city && (capItem.province || capItem.region)
                              ? ', '
                              : ''}
                            {capItem.province || ''}
                            {capItem.province && capItem.region ? ' · ' : ''}
                            {capItem.region || ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-gray-700">
                            {capItem.groups} gruppi ({capItem.groups * 5}{' '}
                            contatti)
                          </div>
                          {capItem.remainder > 0 && (
                            <div className="text-[10px] text-gray-400">
                              {capItem.remainder} contatti in attesa del
                              prossimo gruppo
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {mode === 'contactsOnly' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Elenco contatti
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Tutti i lead raccolti tramite il form di valutazione.
            </p>
          </div>
          <div className="w-full md:w-auto flex flex-col md:flex-row gap-2">
            <div className="md:w-64">
              <input
                type="text"
                placeholder="Cerca per nome, email, città, CAP..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-md bg-white border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Filtra CAP"
              value={capFilter}
              onChange={e => setCapFilter(e.target.value)}
              className="w-full md:w-32 rounded-md bg-white border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
            />
            <input
              type="text"
              placeholder="Filtra città"
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              className="w-full md:w-40 rounded-md bg-white border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
            />
            <select
              value={mediaFilter}
              onChange={e => setMediaFilter(e.target.value)}
              className="w-full md:w-40 bg-white text-xs sm:text-sm text-slate-900 h-9 px-3 rounded-xl border-2 border-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900 appearance-none"
            >
              <option value="all">Tutti i media</option>
              <option value="with-media">Con media</option>
              <option value="floorplan">Con planimetria</option>
              <option value="photos">Con foto</option>
              <option value="ai">Con analisi AI</option>
            </select>
            <select
              value={profileTypeFilter}
              onChange={e => setProfileTypeFilter(e.target.value)}
              className="w-full md:w-44 bg-white text-xs sm:text-sm text-slate-900 h-9 px-3 rounded-xl border-2 border-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900 appearance-none"
            >
              <option value="all">Tutti i profili</option>
              <option value="PROPRIETARIO">Proprietario</option>
              <option value="CLIENTE_ACQUIRENTE">Cliente acquirente</option>
              <option value="PROFESSIONISTA">Professionista</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-6">
          <div className="lg:flex-1 lg:min-w-0">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="overflow-x-auto overflow-y-auto max-h-[540px]">
                <table className="w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Contatti
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Indirizzo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      CAP e città
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Immobile
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Valutazione
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Media / AI
                    </th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredContacts.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-6 text-center text-xs text-gray-500"
                      >
                        Nessun contatto trovato per i filtri selezionati.
                      </td>
                    </tr>
                  )}
                  {filteredContacts.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedContact(c)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-900">
                        {c.contact?.nome} {c.contact?.cognome}
                      </td>
                      <td className="px-4 py-3">
                        <ProfileTypeBadge profileType={c.wizardData?.lead?.profileType} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{c.contact?.email}</div>
                        <div className="text-xs text-gray-400">
                          {c.contact?.telefono}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {c.address?.display || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{c.address?.postcode || 'N/D'}</div>
                        <div className="text-xs text-gray-400">
                          {c.address?.city || ''}{' '}
                          {c.address?.state ? `(${c.address.state})` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>
                          {(c.property?.livingArea || c.property?.area || '-') +
                            ' mq'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {(c.property?.condition || '').trim() ||
                            'Stato N/D'}
                          {typeof c.property?.floor === 'number' && (
                            <span>{` • piano ${c.property.floor}`}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {c.valuation?.valutazione && (
                          <div>
                            <div>
                              {c.valuation.valutazione.prezzoMedio.toLocaleString(
                                'it-IT',
                                { style: 'currency', currency: 'EUR' }
                              )}
                            </div>
                            <div className="text-xs text-gray-400">
                              €/mq{' '}
                              {c.valuation.valutazione.prezzoAlMetroQuadro.toLocaleString(
                                'it-IT',
                                { maximumFractionDigits: 0 }
                              )}
                            </div>
                          </div>
                        )}
                        {!c.valuation?.valutazione &&
                          c.valuation?.totalValue && (
                            <div>
                              <div>
                                {c.valuation.totalValue.toLocaleString('it-IT', {
                                  style: 'currency',
                                  currency: 'EUR'
                                })}
                              </div>
                              <div className="text-xs text-gray-400">
                                €/mq{' '}
                                {c.valuation.pricePerSqm.toLocaleString(
                                  'it-IT',
                                  { maximumFractionDigits: 0 }
                                )}
                              </div>
                            </div>
                          )}
                        {!c.valuation && (
                          <span className="text-xs text-gray-400">N/D</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        <div className="flex flex-wrap gap-1">
                          {c.mediaMeta?.hasFloorplan && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                              <span className="mr-1">📐</span>
                              Planimetria
                            </span>
                          )}
                          {typeof c.mediaMeta?.photosCount === 'number' &&
                            c.mediaMeta.photosCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 border border-sky-100">
                                <span className="mr-1">📷</span>
                                {c.mediaMeta.photosCount} foto
                              </span>
                            )}
                          {c.aiMeta && (
                            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 border border-violet-100">
                              <span className="mr-1">✨</span>
                              AI
                            </span>
                          )}
                          {!c.mediaMeta && !c.aiMeta && (
                            <span className="text-[10px] text-gray-400">
                              Nessun media
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-xs text-gray-600">
                <div>
                  Mostrati {filteredContacts.length}{' '}
                  {filteredContacts.length === 1 ? 'contatto' : 'contatti'}
                  {listTotal ? ` su ${listTotal}` : ''}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage(page => (page > 1 ? page - 1 : page))
                    }
                    disabled={!canGoPrevPage}
                    className={`px-2 py-1 rounded border text-xs ${
                      canGoPrevPage
                        ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    Pagina precedente
                  </button>
                  <span>
                    Pagina {currentPage} di {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage(page =>
                        canGoNextPage ? page + 1 : page
                      )
                    }
                    disabled={!canGoNextPage}
                    className={`px-2 py-1 rounded border text-xs ${
                      canGoNextPage
                        ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    Pagina successiva
                  </button>
                </div>
              </div>
            </div>
          </div>

          {selectedContact && (
            <div className="lg:w-80 xl:w-96 shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-indigo-600 uppercase">
                      Scheda contatto
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      {selectedContact.contact?.nome}{' '}
                      {selectedContact.contact?.cognome}
                    </div>
                    <div className="text-xs text-gray-400">
                      Creato il {formatDate(selectedContact.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadLeadDetail(selectedContact)}
                      className="text-xs px-2 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
                    >
                      Apri scheda completa
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedContact(null)}
                      className="text-xs text-gray-400 hover:text-gray-700"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-semibold text-gray-700">
                      Dati contatto
                    </div>
                    <div className="mt-1 text-gray-600">
                      <div>Email: {selectedContact.contact?.email || '-'}</div>
                      <div>
                        Telefono: {selectedContact.contact?.telefono || '-'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-gray-700">
                      Indirizzo immobile
                    </div>
                    <div className="mt-1 text-gray-600">
                      <div>
                        {selectedContact.address?.display ||
                          'Indirizzo non disponibile'}
                      </div>
                      <div>
                        {selectedContact.address?.postcode || 'N/D'}{' '}
                        {selectedContact.address?.city || ''}{' '}
                        {selectedContact.address?.state
                          ? `(${selectedContact.address.state})`
                          : ''}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-gray-700">
                      Dati immobile
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-gray-600">
                      <div>
                        <div className="text-[10px] uppercase text-gray-400">
                          Superficie principale
                        </div>
                        <div>
                          {selectedContact.property?.livingArea ||
                            selectedContact.property?.area ||
                            '-'}{' '}
                          mq
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-500">
                          Stato immobile
                        </div>
                        <div>{selectedContact.property?.condition || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-500">
                          Piano
                        </div>
                        <div>
                          {selectedContact.property?.floor ?? '-'}
                          {selectedContact.property?.hasElevator !== undefined &&
                            selectedContact.property?.hasElevator !== null && (
                              <span className="text-[10px] text-slate-500 ml-1">
                                {selectedContact.property?.hasElevator
                                  ? 'con ascensore'
                                  : 'senza ascensore'}
                              </span>
                            )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-500">
                          Camere / bagni
                        </div>
                        <div>
                          {(selectedContact.property?.bedrooms ||
                            selectedContact.property?.rooms ||
                            '-') + ' camere'}
                          {selectedContact.property?.bathrooms && (
                            <span>{`, ${selectedContact.property.bathrooms} bagni`}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-500">
                          Spazi esterni
                        </div>
                        <div>
                          {selectedContact.property?.balconyArea ||
                          selectedContact.property?.terraceArea ||
                          selectedContact.property?.gardenArea
                            ? ''
                            : '-'}
                          {selectedContact.property?.balconyArea && (
                            <span>
                              Balcone {selectedContact.property.balconyArea} mq
                            </span>
                          )}
                          {selectedContact.property?.terraceArea && (
                            <span>
                              Terrazzo {selectedContact.property.terraceArea} mq
                            </span>
                          )}
                          {selectedContact.property?.gardenArea && (
                            <span>
                              Giardino {selectedContact.property.gardenArea} mq
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-500">
                          Box / posti auto
                        </div>
                        <div>
                          {selectedContact.property?.parkingSpaces ||
                            selectedContact.property?.garages ||
                            '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-gray-700">
                      Valutazione calcolata
                    </div>
                    <div className="mt-1 text-gray-600">{valuationContent}</div>
                  </div>

                  <div>
                    <div className="font-semibold text-gray-700">
                      Media e AI
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-600">
                      {selectedContact.mediaMeta?.hasFloorplan && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 border border-gray-200 text-xs">
                          <span className="mr-1">📐</span>
                          Planimetria caricata
                        </span>
                      )}
                      {typeof selectedContact.mediaMeta?.photosCount ===
                        'number' &&
                        selectedContact.mediaMeta.photosCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 border border-gray-200 text-xs">
                            <span className="mr-1">📷</span>
                            {selectedContact.mediaMeta.photosCount} foto
                          </span>
                        )}
                      {selectedContact.aiMeta && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 border border-gray-200 text-xs">
                          <span className="mr-1">✨</span>
                          Analisi AI disponibile
                        </span>
                      )}
                      {!selectedContact.mediaMeta && !selectedContact.aiMeta && (
                        <span>Nessun media o analisi AI associata.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {mode === 'contactsOnly' && detailLead && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4">
          <div className="mt-10 mb-10 w-full max-w-4xl rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase text-indigo-600">
                  Scheda completa contatto
                </div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {detailLead.contact?.nome} {detailLead.contact?.cognome}
                </div>
                <div className="text-xs text-gray-500">
                  Creato il {formatDate(detailLead.createdAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailLead(null)
                  setDetailError('')
                }}
                className="text-xs text-gray-400 hover:text-gray-800"
              >
                Chiudi
              </button>
            </div>

            {detailLoading && (
              <div className="mt-4 text-xs text-gray-500">
                Caricamento dettagli in corso...
              </div>
            )}
            {detailError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {detailError}
              </div>
            )}

            {!detailLoading && !detailError && (
              <div className="mt-6 space-y-6 text-xs text-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="font-semibold text-gray-800">
                      Dati contatto
                    </div>
                    <div className="text-gray-600">
                      <div>Email: {detailLead.contact?.email || '-'}</div>
                      <div>Telefono: {detailLead.contact?.telefono || '-'}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-semibold text-gray-800">
                      Indirizzo immobile
                    </div>
                    <div className="text-gray-600">
                      <div>
                        {detailLead.address?.display || 'Indirizzo non disponibile'}
                      </div>
                      <div>
                        {detailLead.address?.postcode || 'N/D'}{' '}
                        {detailLead.address?.city || ''}{' '}
                        {detailLead.address?.state
                          ? `(${detailLead.address.state})`
                          : ''}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="font-semibold text-gray-800">
                      Dati immobile
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-gray-600">
                      <div>
                        <div className="text-[10px] uppercase text-gray-400">
                          Superficie principale
                        </div>
                        <div>
                          {detailLead.property?.livingArea ||
                            detailLead.property?.area ||
                            '-'}{' '}
                          mq
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-gray-400">
                          Stato immobile
                        </div>
                        <div>{detailLead.property?.condition || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-gray-400">
                          Piano
                        </div>
                        <div>
                          {detailLead.property?.floor ?? '-'}
                          {detailLead.property?.hasElevator !== undefined &&
                            detailLead.property?.hasElevator !== null && (
                              <span className="ml-1 text-[10px] text-slate-500">
                                {detailLead.property?.hasElevator
                                  ? 'con ascensore'
                                  : 'senza ascensore'}
                              </span>
                            )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-500">
                          Camere / bagni
                        </div>
                        <div>
                          {(detailLead.property?.bedrooms ||
                            detailLead.property?.rooms ||
                            '-') + ' camere'}
                          {detailLead.property?.bathrooms && (
                            <span>{`, ${detailLead.property.bathrooms} bagni`}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="font-semibold text-gray-800 flex items-center gap-2">
                      Profilo e intenzioni
                      <ProfileTypeBadge profileType={detailLead.wizardData?.lead?.profileType} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-gray-600">
                      {detailLead.wizardData?.lead?.profileType === 'PROPRIETARIO' && (
                        <>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Tempistiche vendita
                            </div>
                            <div>
                              {labelFromOptions(saleTimingOptions, detailLead.wizardData?.lead?.saleTiming)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Vuole agenzie di zona
                            </div>
                            <div>
                              {detailLead.wizardData?.lead?.wantAgenciesValuation
                                ? 'Sì'
                                : detailLead.wizardData?.lead
                                    ?.wantAgenciesValuation === false
                                ? 'No'
                                : '-'}
                            </div>
                          </div>
                        </>
                      )}

                      {detailLead.wizardData?.lead?.profileType === 'CLIENTE_ACQUIRENTE' && (
                        <>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Punto dell'acquisto
                            </div>
                            <div>
                              {labelFromOptions(buyerStageOptions, detailLead.wizardData?.lead?.buyerStage)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Copertura finanziaria
                            </div>
                            <div>
                              {labelFromOptions(buyerFinancingOptions, detailLead.wizardData?.lead?.buyerFinancing)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Tempistiche acquisto
                            </div>
                            <div>
                              {labelFromOptions(buyerTimelineOptions, detailLead.wizardData?.lead?.buyerTimeline)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Vuole supporto trattativa
                            </div>
                            <div>
                              {detailLead.wizardData?.lead?.buyerWantsSupport
                                ? 'Sì'
                                : detailLead.wizardData?.lead
                                    ?.buyerWantsSupport === false
                                ? 'No'
                                : '-'}
                            </div>
                          </div>
                        </>
                      )}

                      {detailLead.wizardData?.lead?.profileType === 'PROFESSIONISTA' && (
                        <>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Ruolo
                            </div>
                            <div>
                              {labelFromOptions(proRoleOptions, detailLead.wizardData?.lead?.proRole)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Agenzia / studio
                            </div>
                            <div>
                              {detailLead.wizardData?.lead?.proAgencyName || '-'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Motivo valutazione
                            </div>
                            <div>
                              {labelFromOptions(proPurposeOptions, detailLead.wizardData?.lead?.proPurpose)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-gray-400">
                              Ha già un mandato
                            </div>
                            <div>
                              {labelFromOptions(proHasMandateOptions, detailLead.wizardData?.lead?.proHasMandate)}
                            </div>
                          </div>
                        </>
                      )}

                      <div>
                        <div className="text-[10px] uppercase text-gray-400">
                          Consenso marketing
                        </div>
                        <div>
                          {detailLead.wizardData?.lead?.marketingConsent
                            ? 'Sì'
                            : 'No'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="font-semibold text-gray-800">
                      Valutazione calcolata
                    </div>
                    <div className="text-gray-600">
                      {detailLead.valuation?.valutazione && (
                        <div className="space-y-1">
                          <div>
                            Range{' '}
                            {detailLead.valuation.valutazione.prezzoMinimo.toLocaleString(
                              'it-IT',
                              { style: 'currency', currency: 'EUR' }
                            )}{' '}
                            -{' '}
                            {detailLead.valuation.valutazione.prezzoMassimo.toLocaleString(
                              'it-IT',
                              { style: 'currency', currency: 'EUR' }
                            )}
                          </div>
                          <div>
                            Prezzo medio{' '}
                            {detailLead.valuation.valutazione.prezzoMedio.toLocaleString(
                              'it-IT',
                              { style: 'currency', currency: 'EUR' }
                            )}
                          </div>
                          <div>
                            €/mq{' '}
                            {detailLead.valuation.valutazione.prezzoAlMetroQuadro.toLocaleString(
                              'it-IT',
                              { maximumFractionDigits: 0 }
                            )}
                          </div>
                        </div>
                      )}
                      {!detailLead.valuation?.valutazione &&
                        detailLead.valuation?.totalValue && (
                          <div className="space-y-1">
                            <div>
                              Range{' '}
                              {detailLead.valuation.minValue.toLocaleString(
                                'it-IT',
                                { style: 'currency', currency: 'EUR' }
                              )}{' '}
                              -{' '}
                              {detailLead.valuation.maxValue.toLocaleString(
                                'it-IT',
                                { style: 'currency', currency: 'EUR' }
                              )}
                            </div>
                            <div>
                              Valore stimato{' '}
                              {detailLead.valuation.totalValue.toLocaleString(
                                'it-IT',
                                { style: 'currency', currency: 'EUR' }
                              )}
                            </div>
                            <div>
                              €/mq{' '}
                              {detailLead.valuation.pricePerSqm.toLocaleString(
                                'it-IT',
                                { maximumFractionDigits: 0 }
                              )}
                            </div>
                          </div>
                        )}
                      {!detailLead.valuation && (
                        <div>Dati valutazione non disponibili.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold text-gray-800">
                    Allegati (planimetria e foto)
                  </div>
                  {detailLead.mediaFiles.length === 0 && (
                    <div className="text-gray-500">
                      Nessun file allegato a questo contatto.
                    </div>
                  )}
                  {detailLead.mediaFiles.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {detailLead.mediaFiles.map(file => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs hover:border-indigo-300 hover:bg-white"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {file.type === 'photo' || file.type === 'foto'
                                ? '📷'
                                : '📐'}
                            </span>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {file.original_name || file.filename}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {file.type === 'photo' || file.type === 'foto'
                                  ? 'Foto immobile'
                                  : 'Planimetria'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-indigo-600">
                            Apri
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {detailLead.aiRecords.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-semibold text-gray-800">
                      Analisi AI
                    </div>
                    <div className="space-y-2">
                      {detailLead.aiRecords.map(record => (
                        <div
                          key={record.id}
                          className="rounded-md border border-violet-200 bg-violet-50 p-3 text-[11px]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-violet-800">
                              <span>✨</span>
                              <span>Analisi AI immagini</span>
                            </div>
                            <div className="text-[10px] text-violet-600">
                              {record.created_at
                                ? formatDate(record.created_at)
                                : ''}
                            </div>
                          </div>
                          {record.summary && record.summary.description && (
                            <div className="mt-2 text-gray-800">
                              {record.summary.description}
                            </div>
                          )}
                          {record.extracted_features && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Array.isArray(record.extracted_features.tags) &&
                                record.extracted_features.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-700"
                                  >
                                    {tag}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ContactsDashboard
