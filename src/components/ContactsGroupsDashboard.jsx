import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAdminLeads, fetchAdminLeadDetail } from '../services/adminLeadsService'
import realOmiService from '../services/realOmiService'
import comuniCap from '../../gi_db_comuni-2026-01-31-6fcd8/json/gi_comuni_cap.json'
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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

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

function getCapsForCity(provinceCode, cityName) {
  if (!provinceCode || !cityName) return []
  const normalizedCity = cityName.toLowerCase()
  return comuniCap
    .filter(
      row =>
        row.sigla_provincia === provinceCode &&
        (row.denominazione_ita || '').toLowerCase() === normalizedCity
    )
    .map(row => row.cap)
}

const comuneByCap = (() => {
  const map = new Map()
  comuniCap.forEach(row => {
    if (row.cap) {
      map.set(row.cap, row)
    }
  })
  return map
})()

function getComuneInfoForCap(cap) {
  if (!cap) return null
  const row = comuneByCap.get(cap)
  if (!row) return null
  return {
    regione: row.denominazione_regione,
    provincia: row.sigla_provincia,
    comune: row.denominazione_ita
  }
}

function buildComuniTree() {
  const byRegion = {}

  comuniCap.forEach(row => {
    const regione = row.denominazione_regione
    const provinciaSigla = row.sigla_provincia
    const provinciaNome = row.denominazione_provincia
    const comune = row.denominazione_ita

    if (!regione || !provinciaSigla || !comune) return

    if (!byRegion[regione]) {
      byRegion[regione] = {
        name: regione,
        totalComuni: 0,
        provinces: {}
      }
    }
    const region = byRegion[regione]

    if (!region.provinces[provinciaSigla]) {
      region.provinces[provinciaSigla] = {
        code: provinciaSigla,
        name: provinciaNome || provinciaSigla,
        comuni: {}
      }
    }
    const prov = region.provinces[provinciaSigla]

    if (!prov.comuni[comune]) {
      prov.comuni[comune] = true
      region.totalComuni += 1
    }
  })

  return Object.values(byRegion)
    .sort((a, b) => a.name.localeCompare(b.name, 'it-IT'))
    .map(region => ({
      ...region,
      provinces: Object.values(region.provinces)
        .sort((a, b) => a.name.localeCompare(b.name, 'it-IT'))
        .map(prov => ({
          ...prov,
          comuni: Object.keys(prov.comuni).sort((a, b) =>
            a.localeCompare(b, 'it-IT')
          )
        }))
    }))
}

function getContactsForComuneFromGroups(groups, regionName, provinceCode, comuneName) {
  if (!Array.isArray(groups) || groups.length === 0) return []
  const region = groups.find(r => r.name === regionName)
  if (!region) return []
  const prov = region.provinces.find(p => p.name === provinceCode)
  if (!prov) return []
  const targetName = (comuneName || '').toLowerCase()
  const city = prov.cities.find(
    c => (c.name || '').toLowerCase() === targetName
  )
  if (!city) return []
  return Array.isArray(city.contacts) ? city.contacts : []
}

function buildGrouping(contacts) {
  const byRegion = {}

  contacts.forEach(contact => {
    const cap = (contact.address?.postcode || '').trim()
    const zoneKey = cap || 'CAP N/D'
    let capInfo = null
    try {
      if (cap) {
        capInfo = realOmiService.getCAPInfo(cap)
      }
    } catch (e) {
      console.error('Errore getCAPInfo per CAP nella funzione buildGrouping', cap, e)
    }

    const rawCity = (contact.address?.city || '').trim()
    let regione = capInfo?.regione || ''
    let provincia = capInfo?.provincia || ''
    let comune = rawCity || capInfo?.comune || ''

    const datasetComune = getComuneInfoForCap(cap)
    if (datasetComune) {
      regione = datasetComune.regione || regione
      provincia = datasetComune.provincia || provincia
      if (!comune) {
        comune = datasetComune.comune || comune
      }
    }

    if (!regione || regione === 'Italia') {
      regione = contact.address?.state || 'Regione N/D'
    }
    if (!provincia || provincia === 'N/A') {
      provincia = 'Provincia N/D'
    }
    if (!comune || comune === 'N/A') {
      comune = rawCity || 'Città N/D'
    }

    const borgo = contact.address?.display || 'Borgo N/D'

    if (!byRegion[regione]) {
      byRegion[regione] = {
        name: regione,
        total: 0,
        provinces: {}
      }
    }
    const regionGroup = byRegion[regione]
    regionGroup.total += 1

    if (!regionGroup.provinces[provincia]) {
      regionGroup.provinces[provincia] = {
        name: provincia,
        total: 0,
        cities: {},
        contacts: []
      }
    }
    const provGroup = regionGroup.provinces[provincia]
    provGroup.total += 1
    provGroup.contacts.push(contact)

    if (!provGroup.cities[comune]) {
      provGroup.cities[comune] = {
        name: comune,
        total: 0,
        zones: {},
        contacts: []
      }
    }
    const cityGroup = provGroup.cities[comune]
    cityGroup.total += 1
    cityGroup.contacts.push(contact)

    if (!cityGroup.zones[zoneKey]) {
      cityGroup.zones[zoneKey] = {
        name: zoneKey,
        cap: cap || '',
        zonaLabel: capInfo?.zona || '',
        total: 0,
        borghi: {},
        contacts: []
      }
    }
    const zoneGroup = cityGroup.zones[zoneKey]
    zoneGroup.total += 1
    zoneGroup.contacts.push(contact)

    if (!zoneGroup.borghi[borgo]) {
      zoneGroup.borghi[borgo] = {
        name: borgo,
        total: 0,
        contacts: []
      }
    }
    const borgoGroup = zoneGroup.borghi[borgo]
    borgoGroup.total += 1
    borgoGroup.contacts.push(contact)
  })

  Object.values(byRegion).forEach(regionGroup => {
    Object.values(regionGroup.provinces).forEach(provGroup => {
      Object.values(provGroup.cities).forEach(cityGroup => {
        const caps = getCapsForCity(provGroup.name, cityGroup.name)
        caps.forEach(capCode => {
          const zoneKey = capCode || 'CAP N/D'
          if (!cityGroup.zones[zoneKey]) {
            cityGroup.zones[zoneKey] = {
              name: zoneKey,
              cap: capCode,
              zonaLabel: '',
              total: 0,
              borghi: {},
              contacts: []
            }
          }
        })
      })
    })
  })

  return Object.values(byRegion)
    .sort((a, b) => a.name.localeCompare(b.name, 'it-IT'))
    .map(region => ({
      ...region,
      provinces: Object.values(region.provinces)
        .sort((a, b) => a.name.localeCompare(b.name, 'it-IT'))
        .map(prov => ({
          ...prov,
          cities: Object.values(prov.cities)
            .sort((a, b) => a.name.localeCompare(b.name, 'it-IT'))
            .map(city => ({
              ...city,
              zones: Object.values(city.zones || {}).sort((a, b) =>
                (a.cap || a.name).localeCompare(b.cap || b.name, 'it-IT')
              )
            }))
        }))
    }))
}

function yesNo(value) {
  if (value === true) return 'Sì'
  if (value === false) return 'No'
  return ''
}

function getValuationSourceLabel(valuation) {
  if (!valuation) return 'Sorgente non disponibile'
  const source = valuation.source || ''
  const meta = valuation.metadati || {}
  if (source === 'omi-ufficiale-comunale') {
    return 'OMI ufficiale comunale'
  }
  if (source === 'ambiguous-cap') {
    return 'CAP ambiguo (più comuni)'
  }
  if (source === 'enhanced-omi-ai') {
    return 'Valutazione potenziata AI'
  }
  if (source === 'real-omi-cap-fallback') {
    return 'Fallback OMI per CAP'
  }
  if (source === 'generic-fallback') {
    return meta.fallbackReason
      ? `Fallback sintetico (${meta.fallbackReason})`
      : 'Fallback sintetico'
  }
  return source || 'Sorgente non disponibile'
}

async function exportContactsToCsv(filename, contacts) {
  if (!contacts || contacts.length === 0) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const enrichedContacts = await Promise.all(
    contacts.map(async contact => {
      let floorplanUrls = []
      let photoUrls = []
      try {
        const detail = await fetchAdminLeadDetail(contact.id)
        const mediaFiles = (detail.media || []).map(item => ({
          ...item,
          url: API_BASE_URL ? `${API_BASE_URL}${item.file_url}` : item.file_url
        }))
        floorplanUrls = mediaFiles
          .filter(file => file.type === 'planimetria')
          .map(file => file.url)
        photoUrls = mediaFiles
          .filter(file => file.type === 'foto' || file.type === 'photo')
          .map(file => file.url)
      } catch (e) {
        console.error(
          'Errore nel fetchLeadMedia in ContactsGroupsDashboard buildContactsWithMedia',
          e
        )
      }

      return {
        ...contact,
        floorplanUrls,
        photoUrls
      }
    })
  )

  const rows = enrichedContacts.map(contact => {
    const cap = (contact.address?.postcode || '').trim()
    let capInfo = null
    try {
      if (cap) {
        capInfo = realOmiService.getCAPInfo(cap)
      }
    } catch (e) {
      console.error(
        'Errore getCAPInfo per CAP in ContactsGroupsDashboard rows builder',
        cap,
        e
      )
    }

    const raw = contact.raw || {}
    const wizardData = contact.wizardData || {}
    const propertyFromContact = contact.property || {}
    const propertyFromWizard = wizardData.property || {}
    const property = {
      ...propertyFromWizard,
      ...propertyFromContact
    }

    const wizardFeatures = wizardData.features || {}
    const wizardExtra = wizardData.extra || {}
    const lead = wizardData.lead || {}
    const valuation = contact.valuation || null

    const numeroCivico =
      raw.housenumber ||
      raw.house_number ||
      extractHouseNumber(raw.indirizzo || contact.address?.display || '')

    const rawComune = raw.citta || contact.address?.city || ''
    const capComune =
      capInfo && capInfo.comune && capInfo.comune !== 'N/A'
        ? capInfo.comune
        : ''
    const comune = capComune || rawComune

    const superficie =
      property.livingArea != null
        ? property.livingArea
        : property.area != null
        ? property.area
        : ''

    const locali =
      property.rooms != null
        ? property.rooms
        : wizardFeatures.rooms != null
        ? wizardFeatures.rooms
        : ''

    const bagni =
      property.bathrooms != null
        ? property.bathrooms
        : wizardFeatures.bathrooms != null
        ? wizardFeatures.bathrooms
        : ''

    const riscaldamento = wizardFeatures.heating || property.heating || ''
    const annoCostruzione =
      wizardFeatures.yearBuilt ||
      property.yearBuilt ||
      ''
    const classeEnergetica =
      wizardFeatures.energyClass || property.energyClass || ''

    const ascensore = yesNo(
      property.hasElevator === true
        ? true
        : property.hasElevator === false
        ? false
        : null
    )

    const hasTerrazzo =
      wizardExtra.hasBalconyOrTerrace === true ||
      (property.terraceArea != null && property.terraceArea > 0)
    const terrazzo = hasTerrazzo ? 'Sì' : wizardExtra.hasBalconyOrTerrace === false ? 'No' : ''

    const hasBalcone =
      property.balconyArea != null && property.balconyArea > 0
    const balcone = hasBalcone ? 'Sì' : property.balconyArea === 0 ? 'No' : ''

    const hasGiardino =
      wizardExtra.hasGarden === true ||
      (property.gardenArea != null && property.gardenArea > 0)
    const giardino = hasGiardino ? 'Sì' : wizardExtra.hasGarden === false ? 'No' : ''

    const hasGarage =
      wizardExtra.hasGarage === true ||
      (property.parkingSpaces != null && property.parkingSpaces > 0)
    const garage = hasGarage ? 'Sì' : wizardExtra.hasGarage === false ? 'No' : ''

    let prezzoMinimo = ''
    let prezzoMedio = ''
    let prezzoMassimo = ''
    if (valuation) {
      if (valuation.valutazione) {
        const v = valuation.valutazione
        if (v.prezzoMinimo != null) prezzoMinimo = v.prezzoMinimo
        if (v.prezzoMedio != null) prezzoMedio = v.prezzoMedio
        if (v.prezzoMassimo != null) prezzoMassimo = v.prezzoMassimo
      } else if (valuation.totalValue != null) {
        if (valuation.minValue != null) prezzoMinimo = valuation.minValue
        prezzoMedio = valuation.totalValue
        if (valuation.maxValue != null) prezzoMassimo = valuation.maxValue
      }
    }

    const planimetriaUrl = (contact.floorplanUrls || []).join(' | ')
    const fotoUrl = (contact.photoUrls || []).join(' | ')

    return [
      contact.contact?.nome || '',
      contact.contact?.cognome || '',
      contact.contact?.email || '',
      contact.contact?.telefono || '',
      contact.createdAt || '',
      contact.address?.display || raw.indirizzo || '',
      numeroCivico,
      contact.address?.postcode || raw.cap || '',
      comune,
      wizardData.propertyType ||
        property.propertyType ||
        property.type ||
        '',
      superficie,
      property.floor != null ? property.floor : '',
      locali,
      bagni,
      property.condition || '',
      riscaldamento,
      annoCostruzione,
      classeEnergetica,
      ascensore,
      terrazzo,
      balcone,
      giardino,
      garage,
      planimetriaUrl,
      fotoUrl,
      PROFILE_TYPE_META[lead.profileType]?.label || lead.profileType || '',
      lead.profileType === 'PROPRIETARIO' ? labelFromOptions(saleTimingOptions, lead.saleTiming) : '',
      lead.profileType === 'PROPRIETARIO' ? yesNo(lead.wantAgenciesValuation) : '',
      lead.profileType === 'CLIENTE_ACQUIRENTE' ? labelFromOptions(buyerStageOptions, lead.buyerStage) : '',
      lead.profileType === 'CLIENTE_ACQUIRENTE' ? labelFromOptions(buyerFinancingOptions, lead.buyerFinancing) : '',
      lead.profileType === 'CLIENTE_ACQUIRENTE' ? labelFromOptions(buyerTimelineOptions, lead.buyerTimeline) : '',
      lead.profileType === 'CLIENTE_ACQUIRENTE' ? yesNo(lead.buyerWantsSupport) : '',
      lead.profileType === 'PROFESSIONISTA' ? labelFromOptions(proRoleOptions, lead.proRole) : '',
      lead.profileType === 'PROFESSIONISTA' ? (lead.proAgencyName || '') : '',
      lead.profileType === 'PROFESSIONISTA' ? labelFromOptions(proPurposeOptions, lead.proPurpose) : '',
      lead.profileType === 'PROFESSIONISTA' ? labelFromOptions(proHasMandateOptions, lead.proHasMandate) : '',
      prezzoMinimo,
      prezzoMedio,
      prezzoMassimo
    ]
  })

  const headers = [
    'Nome',
    'Cognome',
    'Email',
    'Telefono',
    'Data inserimento valutazione',
    'Indirizzo',
    'Numero civico',
    'CAP',
    'Comune',
    'Tipologia appartamento',
    'Superficie (mq)',
    'Piano',
    'Locali',
    'Bagni',
    'Stato immobile',
    'Riscaldamento',
    'Anno di costruzione',
    'Classe energetica',
    'Ascensore',
    'Terrazzo',
    'Balcone',
    'Giardino',
    'Garage',
    'Planimetria (URL scaricabile)',
    'Foto immobile (URL scaricabili)',
    'Richiedi come',
    'Tempistiche vendita (proprietario)',
    'Vuole agenzie di zona (proprietario)',
    'Punto acquisto (cliente acquirente)',
    'Copertura finanziaria (cliente acquirente)',
    'Tempistiche acquisto (cliente acquirente)',
    'Vuole supporto trattativa (cliente acquirente)',
    'Ruolo (professionista)',
    'Agenzia o studio (professionista)',
    'Motivo valutazione (professionista)',
    'Ha già un mandato (professionista)',
    'Prezzo minimo di valutazione',
    'Prezzo medio di valutazione',
    'Prezzo massimo di valutazione'
  ]

  const escapeCell = value => {
    if (value === null || value === undefined) return ''
    let v = String(value)
    if (/^[-+]?\d+$/.test(v) && v.length >= 7) {
      v = `="${v}"`
    }
    if (v.includes('"') || v.includes(';') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`
    }
    return v
  }

  const csv = [
    headers.map(escapeCell).join(';'),
    ...rows.map(row => row.map(value => escapeCell(value)).join(';'))
  ].join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function parseLeadDate(value) {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (trimmed.includes('T')) {
    const d = new Date(trimmed)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const iso = trimmed.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function extractHouseNumber(addressString) {
  if (!addressString) return ''
  const firstPart = String(addressString).split(',')[0]
  const match = firstPart.match(/(\d+[A-Za-z0-9/\\-]*)\s*$/)
  return match ? match[1] : ''
}

function ContactsGroupsDashboard({ mode }) {
  const [contacts, setContacts] = useState([])
  const [daysFilter, setDaysFilter] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedRegion, setExpandedRegion] = useState(null)
  const [expandedProvinceKey, setExpandedProvinceKey] = useState(null)
  const [selectedCityView, setSelectedCityView] = useState(null)
  const [selectedCityCapFilter, setSelectedCityCapFilter] = useState('all')
  const [selectedCityDateFrom, setSelectedCityDateFrom] = useState('')
  const [selectedCityDateTo, setSelectedCityDateTo] = useState('')
  const [selectedCitySelectedIds, setSelectedCitySelectedIds] = useState([])
  const [lastSeenNewContactsAt, setLastSeenNewContactsAt] = useState(null)
  const [scopedLastSeen, setScopedLastSeen] = useState({
    city: {},
    cap: {}
  })
  const [autoGroupsLastSeenAt, setAutoGroupsLastSeenAt] = useState(null)
  const [expandedAutoGroupId, setExpandedAutoGroupId] = useState(null)
  const [detailLead, setDetailLead] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const loadFromApi = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params = {}
      if (daysFilter > 0) {
        const now = new Date()
        const from = new Date(
          now.getTime() - daysFilter * 24 * 60 * 60 * 1000
        )
        params.from = from.toISOString()
      }
      params.limit = 200
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
          console.error(
            'Errore nel parsing di media_meta in ContactsGroupsDashboard loadFromApi',
            e
          )
        }
        try {
          aiMeta = item.ai_analysis_meta
            ? JSON.parse(item.ai_analysis_meta)
            : null
        } catch (e) {
          console.error(
            'Errore nel parsing di ai_analysis_meta in ContactsGroupsDashboard loadFromApi',
            e
          )
        }
        try {
          wizardData = item.step_data ? JSON.parse(item.step_data) : null
          if (wizardData && wizardData.property) {
            property = wizardData.property
          }
        } catch (e) {
          console.error(
            'Errore nel parsing di step_data in ContactsGroupsDashboard loadFromApi',
            e
          )
        }
        try {
          valuation = item.valuation_data
            ? JSON.parse(item.valuation_data)
            : null
        } catch (e) {
          console.error(
            'Errore nel parsing di valuation_data in ContactsGroupsDashboard loadFromApi',
            e
          )
        }
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
            raw: item
          }
        }) || []
      setContacts(mapped)
    } catch (e) {
      setError(e.message || 'Errore nel caricamento dei lead raggruppati')
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [daysFilter])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('admin_contacts_last_seen')
      if (stored) {
        setLastSeenNewContactsAt(stored)
      }
      const scopedRaw = window.localStorage.getItem(
        'admin_contacts_last_seen_scoped'
      )
        if (scopedRaw) {
          try {
            const parsed = JSON.parse(scopedRaw)
            setScopedLastSeen({
              city: parsed.city || {},
              cap: parsed.cap || {}
            })
          } catch (e) {
            console.error(
              'Errore nel parsing di admin_contacts_last_seen_scoped in ContactsGroupsDashboard',
              e
            )
          }
        }
      const autoStored = window.localStorage.getItem(
        'admin_auto_groups_last_seen'
      )
      if (autoStored) {
        setAutoGroupsLastSeenAt(autoStored)
      }
    }
  }, [])

  useEffect(() => {
    loadFromApi()
  }, [loadFromApi])

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
        console.error('Errore nel parsing di step_data in ContactsGroupsDashboard', e)
      }
      if (
        (!property || Object.keys(property).length === 0) &&
        wizardData &&
        wizardData.property
      ) {
        property = wizardData.property
      }
      try {
        if (!valuation && data.lead?.valuation_data) {
          valuation = JSON.parse(data.lead.valuation_data)
        }
      } catch (e) {
        console.error('Errore nel parsing di valuation_data in ContactsGroupsDashboard', e)
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
          console.error('Errore nel parsing di ai.summary in ContactsGroupsDashboard', e)
        }
        try {
          extracted = item.extracted_features
            ? JSON.parse(item.extracted_features)
            : null
        } catch (e) {
          console.error(
            'Errore nel parsing di ai.extracted_features in ContactsGroupsDashboard',
            e
          )
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

  const groups = useMemo(() => buildGrouping(contacts), [contacts])
  const comuniTree = useMemo(() => buildComuniTree(), [])
  const filteredCityContacts = useMemo(() => {
    if (!selectedCityView || !selectedCityView.contacts) return []
    return selectedCityView.contacts.filter(contact => {
      if (
        selectedCityCapFilter !== 'all' &&
        (contact.address?.postcode || '').trim() !== selectedCityCapFilter
      ) {
        return false
      }
      if (selectedCityDateFrom) {
        const dFrom = new Date(selectedCityDateFrom)
        const dCreated = parseLeadDate(contact.createdAt)
        if (!Number.isNaN(dFrom.getTime()) && dCreated) {
          if (dCreated < dFrom) return false
        }
      }
      if (selectedCityDateTo) {
        const dTo = new Date(selectedCityDateTo)
        const dCreated = parseLeadDate(contact.createdAt)
        if (!Number.isNaN(dTo.getTime()) && dCreated) {
          const dToEnd = new Date(
            dTo.getFullYear(),
            dTo.getMonth(),
            dTo.getDate(),
            23,
            59,
            59,
            999
          )
          if (dCreated > dToEnd) return false
        }
      }
      return true
    })
  }, [selectedCityView, selectedCityCapFilter, selectedCityDateFrom, selectedCityDateTo])

  const selectedCityCapsInfo = useMemo(() => {
    if (!selectedCityView) {
      return { caps: [], counts: new Map() }
    }
    const baseContacts = selectedCityView.contacts || []
    const counts = baseContacts.reduce((acc, c) => {
      const cap = (c.address?.postcode || '').trim()
      if (!cap) return acc
      const prev = acc.get(cap) || 0
      acc.set(cap, prev + 1)
      return acc
    }, new Map())

    const datasetCaps = getCapsForCity(
      selectedCityView.provinceCode,
      selectedCityView.city
    )
    const capsSet = new Set(datasetCaps || [])
    counts.forEach((_, cap) => capsSet.add(cap))
    const caps = Array.from(capsSet).sort((a, b) =>
      a.localeCompare(b, 'it-IT')
    )

    return { caps, counts }
  }, [selectedCityView])

  const getThresholdForScope = useCallback(
    (regionName, provinceCode, cityName, capValue) => {
      let t = null
      if (lastSeenNewContactsAt) {
        const d = new Date(lastSeenNewContactsAt)
        if (!Number.isNaN(d.getTime())) {
          t = d
        }
      }
      const cityKey = `${regionName}|||${provinceCode}|||${cityName}`
      const citySeen = scopedLastSeen.city[cityKey]
      if (citySeen) {
        const d = new Date(citySeen)
        if (!Number.isNaN(d.getTime())) {
          if (!t || d > t) t = d
        }
      }
      const capTrimmed = (capValue || '').trim()
      if (capTrimmed) {
        const capKey = `${regionName}|||${provinceCode}|||${cityName}|||${capTrimmed}`
        const capSeen = scopedLastSeen.cap[capKey]
        if (capSeen) {
          const d = new Date(capSeen)
          if (!Number.isNaN(d.getTime())) {
            if (!t || d > t) t = d
          }
        }
      }
      return t
    },
    [lastSeenNewContactsAt, scopedLastSeen]
  )

  const newContactsFlags = useMemo(() => {
    if (!groups || groups.length === 0) {
      return {
        regions: [],
        provinces: new Set(),
        cities: new Set(),
        totalNewContacts: 0
      }
    }
    const regionSet = new Set()
    const provinceSet = new Set()
    const citySet = new Set()
    let newContactsCount = 0

    groups.forEach(region => {
      let regionHasNew = false
      region.provinces.forEach(prov => {
        let provinceHasNew = false
        Object.values(prov.cities || {}).forEach(city => {
          const comuneContacts = Array.isArray(city.contacts)
            ? city.contacts
            : []
          if (!comuneContacts || comuneContacts.length === 0) return
          let hasNew = false
          comuneContacts.forEach(contact => {
            const created = parseLeadDate(contact.createdAt)
            if (!created) return
            const cap = (contact.address?.postcode || '').trim()
            const threshold = getThresholdForScope(
              region.name,
              prov.name,
              city.name,
              cap
            )
            if (!threshold || created > threshold) {
              hasNew = true
              newContactsCount += 1
            }
          })
          if (hasNew) {
            const cityKey = `${region.name}|||${prov.code || prov.name}|||${city.name}`
            citySet.add(cityKey)
            provinceHasNew = true
            regionHasNew = true
          }
        })
        if (provinceHasNew) {
          const provinceKey = `${region.name}|||${prov.code || prov.name}`
          provinceSet.add(provinceKey)
        }
      })
      if (regionHasNew) {
        regionSet.add(region.name)
      }
    })

    return {
      regions: Array.from(regionSet),
      provinces: provinceSet,
      cities: citySet,
      totalNewContacts: newContactsCount
    }
  }, [groups, getThresholdForScope])

  const regionsWithNewContacts = newContactsFlags.regions
  const totalNewContacts = newContactsFlags.totalNewContacts || 0

  const autoGroupingData = useMemo(() => {
    if (mode !== 'autoGrouping' || !groups || groups.length === 0) {
      return { regions: [], newCount: 0 }
    }
    let threshold = null
    if (autoGroupsLastSeenAt) {
      const d = new Date(autoGroupsLastSeenAt)
      if (!Number.isNaN(d.getTime())) {
        threshold = d
      }
    }
    const regions = []
    let newCount = 0

    groups.forEach(region => {
      const regionNode = {
        name: region.name,
        provinces: [],
        totalGroups: 0
      }
      region.provinces.forEach(prov => {
        const provNode = {
          name: prov.name,
          cities: [],
          totalGroups: 0
        }
        prov.cities.forEach(city => {
          const cityGroups = []
          ;(city.zones || []).forEach(zone => {
            const zoneContacts = Array.isArray(zone.contacts)
              ? zone.contacts.slice()
              : []
            if (zoneContacts.length < 5) {
              return
            }
            zoneContacts.sort((a, b) => {
              const da = parseLeadDate(a.createdAt)
              const db = parseLeadDate(b.createdAt)
              if (!da && !db) return 0
              if (!da) return -1
              if (!db) return 1
              return da - db
            })
            let groupIndex = 0
            for (let i = 0; i + 4 < zoneContacts.length; i += 5) {
              const chunk = zoneContacts.slice(i, i + 5)
              let latest = null
              chunk.forEach(c => {
                const d = parseLeadDate(c.createdAt)
                if (!d) return
                if (!latest || d > latest) {
                  latest = d
                }
              })
              const latestIso = latest ? latest.toISOString() : null
              let isNew = false
              if (latest) {
                if (!threshold || latest > threshold) {
                  isNew = true
                }
              }
              if (isNew) {
                newCount += 1
              }
              const groupCap = zone.cap || zone.name || ''
              cityGroups.push({
                id: `${region.name}|||${prov.name}|||${city.name}|||${groupCap}|||${groupIndex}`,
                regionName: region.name,
                provinceName: prov.name,
                cityName: city.name,
                cap: groupCap,
                groupNumber: groupIndex + 1,
                contacts: chunk,
                createdAt: latestIso,
                isNew
              })
              groupIndex += 1
            }
          })
          if (cityGroups.length > 0) {
            provNode.cities.push({
              name: city.name,
              groups: cityGroups
            })
            provNode.totalGroups += cityGroups.length
          }
        })
        if (provNode.totalGroups > 0) {
          regionNode.provinces.push(provNode)
          regionNode.totalGroups += provNode.totalGroups
        }
      })
      if (regionNode.totalGroups > 0) {
        regions.push(regionNode)
      }
    })

    return { regions, newCount }
  }, [mode, groups, autoGroupsLastSeenAt])

  const handleMarkAllAsSeen = () => {
    const nowIso = new Date().toISOString()
    setLastSeenNewContactsAt(nowIso)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin_contacts_last_seen', nowIso)
      const nextScoped = {
        city: {},
        cap: {}
      }
      window.localStorage.setItem(
        'admin_contacts_last_seen_scoped',
        JSON.stringify(nextScoped)
      )
      setScopedLastSeen(nextScoped)
    }
  }

  const handleMarkAutoGroupsAsSeen = () => {
    const nowIso = new Date().toISOString()
    setAutoGroupsLastSeenAt(nowIso)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin_auto_groups_last_seen', nowIso)
    }
  }

  const isAutoMode = mode === 'autoGrouping'

  const handleMarkCityAsSeen = () => {
    if (!selectedCityView) return
    const nowIso = new Date().toISOString()
    const cityKey = `${selectedCityView.region}|||${selectedCityView.provinceCode}|||${selectedCityView.city}`
    setScopedLastSeen(prev => {
      const nextCity = {
        ...(prev.city || {}),
        [cityKey]: nowIso
      }
      const next = {
        city: nextCity,
        cap: prev.cap || {}
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'admin_contacts_last_seen_scoped',
          JSON.stringify(next)
        )
      }
      return next
    })
  }

  const handleMarkCapAsSeen = () => {
    if (!selectedCityView || selectedCityCapFilter === 'all') return
    const nowIso = new Date().toISOString()
    const capKey = `${selectedCityView.region}|||${selectedCityView.provinceCode}|||${selectedCityView.city}|||${selectedCityCapFilter}`
    setScopedLastSeen(prev => {
      const nextCap = {
        ...(prev.cap || {}),
        [capKey]: nowIso
      }
      const next = {
        city: prev.city || {},
        cap: nextCap
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'admin_contacts_last_seen_scoped',
          JSON.stringify(next)
        )
      }
      return next
    })
  }

  const handleResetNotifications = () => {
    setScopedLastSeen({
      city: {},
      cap: {}
    })
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'admin_contacts_last_seen_scoped',
        JSON.stringify({
          city: {},
          cap: {}
        })
      )
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isAutoMode ? 'Raggruppamento automatico' : 'Mappa comuni italiani'}
          </h1>
          <p className="mt-1 text-xs text-gray-500 max-w-xl">
            {isAutoMode
              ? 'Crea gruppi automatici di 5 contatti con lo stesso CAP per Regione, Provincia e Comune.'
              : 'Esplora i comuni italiani, filtra i lead per CAP e periodo ed esporta elenchi CSV dei contatti selezionati.'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {!isAutoMode && regionsWithNewContacts.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-red-600">
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
              <span>
                Nuovi contatti in {regionsWithNewContacts.length} regioni, valutazioni{' '}
                {totalNewContacts}
              </span>
              <button
                type="button"
                onClick={handleMarkAllAsSeen}
                className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-100"
              >
                Segna come letti
              </button>
            </div>
          )}
          {isAutoMode && autoGroupingData.newCount > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-red-600">
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
              <span>
                Nuovi gruppi automatici: {autoGroupingData.newCount}
              </span>
              <button
                type="button"
                onClick={handleMarkAutoGroupsAsSeen}
                className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-100"
              >
                Segna come letti
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={handleResetNotifications}
              className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700"
            >
              Reset notifiche
            </button>
            <select
              value={daysFilter}
              onChange={e => setDaysFilter(Number(e.target.value))}
              className="bg-white text-xs text-slate-900 h-9 px-3 rounded-xl border-2 border-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900 appearance-none"
            >
              <option value={7}>Ultimi 7 giorni</option>
              <option value={30}>Ultimi 30 giorni</option>
              <option value={90}>Ultimi 90 giorni</option>
              <option value={0}>Tutti i contatti</option>
            </select>
            <button
              type="button"
              onClick={loadFromApi}
              className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700"
            >
              {loading ? 'Aggiornamento...' : 'Aggiorna dati'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {!error && groups.length === 0 && !loading && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-xs text-gray-500">
          Nessun contatto disponibile per i filtri selezionati.
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-xs text-gray-500">
          Caricamento dati contatti in corso...
        </div>
      )}

      {!isAutoMode && comuniTree.length > 0 && (
        <div className="mt-8 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Mappa comuni italiani
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Naviga per regioni, province e comuni utilizzando il database
              completo dei comuni italiani.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comuniTree.map(region => {
              const isRegionOpen = expandedRegion === region.name
              const hasNewContacts = regionsWithNewContacts.includes(region.name)
              return (
                <div
                  key={region.name}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const next =
                        expandedRegion === region.name ? null : region.name
                      setExpandedRegion(next)
                      setExpandedProvinceKey(null)
                    }}
                    className="flex items-center justify-between gap-3 w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      {hasNewContacts && (
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      )}
                      <div>
                        <div className="text-[11px] font-semibold text-gray-500 uppercase">
                          Regione
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                          {region.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-gray-900">
                        {region.totalComuni}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        comuni totali
                      </div>
                    </div>
                  </button>

                  {isRegionOpen && (
                    <div className="mt-3 border-t border-gray-100 pt-2 space-y-1.5 max-h-64 overflow-auto">
                      {region.provinces.map(prov => {
                        const provinceKey = `${region.name}_${prov.code}`
                        const isProvinceOpen =
                          expandedProvinceKey === provinceKey
                        const provinceNewKey = `${region.name}|||${prov.code}`
                        const provinceHasNew =
                          newContactsFlags.provinces.has(provinceNewKey)
                        return (
                          <div
                            key={provinceKey}
                            className="rounded-md bg-gray-50 px-2 py-1.5"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedProvinceKey(
                                  isProvinceOpen ? null : provinceKey
                                )
                              }
                              className="flex items-center justify-between gap-3 w-full text-left"
                            >
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                {provinceHasNew && (
                                  <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                                )}
                                <div className="min-w-0">
                                  <div className="text-[11px] font-medium text-gray-900 truncate">
                                    {prov.name}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    {prov.comuni.length} comuni
                                  </div>
                                </div>
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {prov.code}
                              </div>
                            </button>
                            {isProvinceOpen && (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {prov.comuni.map(comune => {
                                  const cityKey = `${region.name}|||${prov.code}|||${comune}`
                                  const cityHasNew =
                                    newContactsFlags.cities.has(cityKey)
                                  const handleClickComune = () => {
                                    const comuneContacts =
                                      getContactsForComuneFromGroups(
                                        groups,
                                        region.name,
                                        prov.code,
                                        comune
                                      )
                                    setSelectedCityCapFilter('all')
                                    setSelectedCityDateFrom('')
                                    setSelectedCityDateTo('')
                                    setSelectedCitySelectedIds([])
                                    setSelectedCityView({
                                      region: region.name,
                                      provinceCode: prov.code,
                                      provinceName: prov.name,
                                      city: comune,
                                      contacts: comuneContacts
                                    })
                                  }
                                  return (
                                    <button
                                      key={comune}
                                      type="button"
                                      onClick={handleClickComune}
                                      className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50"
                                    >
                                      {cityHasNew && (
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-500 mr-1" />
                                      )}
                                      <span>{comune}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isAutoMode && !loading && !error && autoGroupingData.regions.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-xs text-gray-500">
          Nessun gruppo automatico disponibile. I gruppi vengono creati quando ci sono almeno 5 contatti con lo stesso CAP.
        </div>
      )}

      {isAutoMode && autoGroupingData.regions.length > 0 && (
        <div className="mt-8 space-y-4">
          {autoGroupingData.regions.map(region => (
            <div
              key={region.name}
              className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-gray-500 uppercase">
                    Regione
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {region.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold text-gray-900">
                    {region.totalGroups}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    gruppi automatici
                  </div>
                </div>
              </div>

              <div className="mt-3 border-t border-gray-100 pt-2 space-y-3">
                {region.provinces.map(prov => (
                  <div key={prov.name}>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-700">
                        Provincia {prov.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {prov.totalGroups} gruppi
                      </div>
                    </div>
                    <div className="mt-1 space-y-2">
                      {prov.cities.map(city => (
                        <div
                          key={city.name}
                          className="rounded-md bg-gray-50 px-2 py-2"
                        >
                          <div className="text-[11px] font-semibold text-gray-700">
                            {city.name}
                          </div>
                          <div className="mt-1 space-y-1.5">
                            {city.groups.map(group => (
                              <div
                                key={group.id}
                                className="rounded-md bg-white px-2 py-1.5 border border-gray-200"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    {group.isNew && (
                                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                                    )}
                                    <div>
                                      <div className="text-[11px] font-medium text-gray-900">
                                        CAP {group.cap || 'N/D'} · gruppo #{group.groupNumber}{' '}
                                        · {group.contacts.length} contatti
                                      </div>
                                      <div className="mt-0.5 flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-700 border border-emerald-100">
                                          Pronto per vendita in blocco
                                        </span>
                                        {group.createdAt && (
                                          <span className="text-[10px] text-gray-500">
                                            Ultimo contatto: {formatDate(group.createdAt)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedAutoGroupId(prev =>
                                          prev === group.id ? null : group.id
                                        )
                                      }
                                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      {expandedAutoGroupId === group.id
                                        ? 'Nascondi contatti'
                                        : 'Vedi contatti'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        exportContactsToCsv(
                                          `gruppo_auto_${group.cap || 'ND'}_${group.groupNumber}.csv`,
                                          group.contacts
                                        )
                                      }
                                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      Esporta gruppo
                                    </button>
                                  </div>
                                </div>
                                {expandedAutoGroupId === group.id && (
                                  <div className="mt-2 border-t border-gray-100 pt-2">
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full border-collapse">
                                        <thead>
                                          <tr className="text-[10px] text-gray-500 text-left border-b border-gray-200">
                                            <th className="py-1 pr-3 font-medium">Nome</th>
                                            <th className="py-1 pr-3 font-medium">Email</th>
                                            <th className="py-1 pr-3 font-medium">Telefono</th>
                                            <th className="py-1 pr-3 font-medium">Indirizzo</th>
                                            <th className="py-1 pr-3 font-medium">Ingresso</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {group.contacts.map(contact => (
                                            <tr
                                              key={contact.id}
                                              className="text-[10px] text-gray-700 border-b border-gray-100 last:border-0"
                                            >
                                              <td className="py-1 pr-3">
                                                {contact.contact?.nome} {contact.contact?.cognome}
                                              </td>
                                              <td className="py-1 pr-3">
                                                {contact.contact?.email}
                                              </td>
                                              <td className="py-1 pr-3">
                                                {contact.contact?.telefono}
                                              </td>
                                              <td className="py-1 pr-3">
                                                {contact.address?.display}
                                              </td>
                                              <td className="py-1 pr-3">
                                                {formatDate(contact.createdAt)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCityView && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 py-8">
          <div className="mt-8 w-full max-w-5xl rounded-2xl bg-white shadow-xl border border-gray-200 max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase">
                  Comune
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {selectedCityView.city}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {selectedCityView.provinceName} ({selectedCityView.provinceCode}) ·{' '}
                  {selectedCityView.region}
                </div>
                {selectedCityCapsInfo.caps.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-gray-500 mr-1">
                        Filtra per CAP:
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedCityCapFilter('all')}
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${
                          selectedCityCapFilter === 'all'
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Tutti
                      </button>
                      {selectedCityCapsInfo.caps.map(cap => {
                        const count =
                          selectedCityCapsInfo.counts.get(cap) || 0
                        const hasNew = (() => {
                          if (!selectedCityView) return false
                          const threshold = getThresholdForScope(
                            selectedCityView.region,
                            selectedCityView.provinceCode,
                            selectedCityView.city,
                            cap
                          )
                          const baseContacts = selectedCityView.contacts || []
                          if (baseContacts.length === 0) return false
                          return baseContacts.some(contact => {
                            const cCap = (contact.address?.postcode || '').trim()
                            if (cCap !== cap) return false
                            const created = parseLeadDate(contact.createdAt)
                            if (!created) return false
                            if (!threshold) return true
                            return created > threshold
                          })
                        })()
                        return (
                          <button
                            key={cap}
                            type="button"
                            onClick={() => setSelectedCityCapFilter(cap)}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${
                              selectedCityCapFilter === cap
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              {hasNew && (
                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                              )}
                              <span>{cap}</span>
                            </span>
                            <span className="ml-1 text-[9px] text-gray-500">
                              ({count})
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span>Filtra per data ingresso:</span>
                      <label className="flex items-center gap-1">
                        <span>da</span>
                        <input
                          type="date"
                          value={selectedCityDateFrom}
                          onChange={e => setSelectedCityDateFrom(e.target.value)}
                          className="border border-gray-300 rounded-md px-2 py-1 text-[11px]"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <span>a</span>
                        <input
                          type="date"
                          value={selectedCityDateTo}
                          onChange={e => setSelectedCityDateTo(e.target.value)}
                          className="border border-gray-300 rounded-md px-2 py-1 text-[11px]"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {filteredCityContacts.length > 0 && (
                  <div className="flex flex-col items-end gap-1 mr-2">
                    <button
                      type="button"
                      onClick={handleMarkCityAsSeen}
                      className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-100"
                    >
                      Segna come letti (comune)
                    </button>
                    {selectedCityCapFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={handleMarkCapAsSeen}
                        className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 hover:bg-blue-100"
                      >
                        Segna come letti (CAP {selectedCityCapFilter})
                      </button>
                    )}
                  </div>
                )}
                <div className="text-right">
                  <div className="text-base font-semibold text-gray-900">
                    {filteredCityContacts.length}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    contatti in questo comune
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCityView(null)
                    setSelectedCityCapFilter('all')
                    setSelectedCityDateFrom('')
                    setSelectedCityDateTo('')
                    setSelectedCitySelectedIds([])
                  }}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Chiudi
                </button>
              </div>
            </div>

            {filteredCityContacts.length === 0 && (
              <div className="px-5 py-6 text-xs text-gray-500">
                Nessun contatto presente per questo comune nei filtri selezionati.
              </div>
            )}

            {filteredCityContacts.length > 0 && (
              <div className="px-5 py-4 overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] text-gray-500">
                    Seleziona i contatti da esportare
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = filteredCityContacts.map(c => c.id)
                        setSelectedCitySelectedIds(allIds)
                      }}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                    >
                      Seleziona tutti
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCitySelectedIds([])}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                    >
                      Pulisci selezione
                    </button>
                    <button
                      type="button"
                      disabled={selectedCitySelectedIds.length === 0}
                      onClick={() => {
                        const toExport = filteredCityContacts.filter(c =>
                          selectedCitySelectedIds.includes(c.id)
                        )
                        if (toExport.length === 0) return
                        const capPart =
                          selectedCityCapFilter === 'all'
                            ? 'tutti_cap'
                            : selectedCityCapFilter
                        const fromPart = selectedCityDateFrom || 'inizio'
                        const toPart = selectedCityDateTo || 'oggi'
                        exportContactsToCsv(
                          `contatti_${selectedCityView.city}_${capPart}_${fromPart}_${toPart}.csv`,
                          toExport
                        )
                      }}
                      className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] ${
                        selectedCitySelectedIds.length === 0
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      Esporta selezionati
                    </button>
                  </div>
                </div>
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">
                        <input
                          type="checkbox"
                          checked={
                            filteredCityContacts.length > 0 &&
                            selectedCitySelectedIds.length ===
                              filteredCityContacts.length
                          }
                          onChange={e => {
                            if (e.target.checked) {
                              const allIds = filteredCityContacts.map(c => c.id)
                              setSelectedCitySelectedIds(allIds)
                            } else {
                              setSelectedCitySelectedIds([])
                            }
                          }}
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Nome
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Contatti
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Indirizzo
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        CAP e città
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Creato il
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredCityContacts.map(contact => {
                      const checked = selectedCitySelectedIds.includes(contact.id)
                      const capValue = (contact.address?.postcode || '').trim()
                      const isNew = (() => {
                        if (
                          !selectedCityView ||
                          !contact.createdAt
                        ) {
                          return false
                        }
                        const created = parseLeadDate(contact.createdAt)
                        if (!created) return false
                        const threshold = getThresholdForScope(
                          selectedCityView.region,
                          selectedCityView.provinceCode,
                          selectedCityView.city,
                          capValue
                        )
                        if (!threshold) return true
                        return created > threshold
                      })()
                      return (
                        <tr key={contact.id}>
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedCitySelectedIds([
                                    ...selectedCitySelectedIds,
                                    contact.id
                                  ])
                                } else {
                                  setSelectedCitySelectedIds(
                                    selectedCitySelectedIds.filter(
                                      id => id !== contact.id
                                    )
                                  )
                                }
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                            <div className="flex items-center gap-1.5">
                              {isNew && (
                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                              )}
                              <span>
                                {contact.contact?.nome || '-'}{' '}
                                {contact.contact?.cognome || ''}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            <div>{contact.contact?.email || '-'}</div>
                            <div className="text-[11px] text-gray-500">
                              {contact.contact?.telefono || '-'}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {contact.address?.display || '-'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {contact.address?.postcode || '-'}{' '}
                            {contact.address?.city || ''}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {formatDate(contact.createdAt)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => loadLeadDetail(contact)}
                              className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              Scheda completa
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {detailLead && (
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    exportContactsToCsv(
                      `contatto_${detailLead.address?.city || 'n-a'}_${
                        detailLead.address?.postcode || 'n-a'
                      }_${detailLead.id}.csv`,
                      [detailLead]
                    )
                  }}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  Esporta contatto
                </button>
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
                      <div>
                        Nome: {detailLead.contact?.nome || '-'}{' '}
                        {detailLead.contact?.cognome || ''}
                      </div>
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
                      <div>
                        Numero civico:{' '}
                        {extractHouseNumber(detailLead.address?.display || '') || 'N/D'}
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
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-gray-800">
                      Valutazione calcolata
                    </div>
                    <div className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                      {getValuationSourceLabel(detailLead.valuation)}
                    </div>
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
                    {detailLead.valuation?.metadati && (
                      <div className="mt-3 space-y-0.5 text-[11px] text-gray-500">
                        {detailLead.valuation.metadati.semestre && (
                          <div>
                            Semestre OMI:{' '}
                            {detailLead.valuation.metadati.semestre}
                          </div>
                        )}
                        {detailLead.valuation.metadati.descrTipologia && (
                          <div>
                            Tipologia OMI:{' '}
                            {detailLead.valuation.metadati.descrTipologia}
                          </div>
                        )}
                        {(detailLead.valuation.metadati.zoneCountUsed != null ||
                          detailLead.valuation.metadati.numComuniForCap !=
                            null) && (
                          <div>
                            Zone considerate:{' '}
                            {detailLead.valuation.metadati.zoneCountUsed ?? '-'}
                            {detailLead.valuation.metadati
                              .numComuniForCap != null && (
                              <>
                                {' '}
                                · Comuni per CAP:{' '}
                                {
                                  detailLead.valuation.metadati
                                    .numComuniForCap
                                }
                              </>
                            )}
                          </div>
                        )}
                        {detailLead.valuation.metadati.fallbackReason && (
                          <div>
                            Fallback:{' '}
                            {detailLead.valuation.metadati.fallbackReason}
                          </div>
                        )}
                      </div>
                    )}
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

export default ContactsGroupsDashboard
