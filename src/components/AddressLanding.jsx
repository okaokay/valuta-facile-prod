import { useEffect, useRef, useState } from 'react'
import {
  searchAddresses,
  enrichAddressWithCAP
} from '../services/enhancedAddressService'

function AddressLanding({ draftAddress, setDraftAddress, onNext }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parsedHouseNumber, setParsedHouseNumber] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searched, setSearched] = useState(false)
  const timeoutRef = useRef(null)
  const requestIdRef = useRef(0)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    if (draftAddress && draftAddress.display) {
      setQuery(draftAddress.display)
    }
  }, [draftAddress])

  const parseInput = (value) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return { normalized: '', houseNumber: '' }
    }
    const parts = trimmed.split(/\s+/)
    let index = -1
    for (let i = 0; i < parts.length; i += 1) {
      if (/\d/.test(parts[i])) {
        index = i
        break
      }
    }
    if (index === -1) {
      return { normalized: trimmed, houseNumber: '' }
    }
    const houseNumber = parts[index]
    const before = parts.slice(0, index).join(' ')
    const after = parts.slice(index + 1).join(' ')
    const normalized = [before, after].filter(Boolean).join(' ')
    return {
      normalized: normalized || trimmed,
      houseNumber
    }
  }

  const handleSearch = (value) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    // Annulla la richiesta precedente ancora in volo: senza questo, se
    // l'utente scrive velocemente, una risposta "vecchia" arrivata in
    // ritardo poteva sovrascrivere i suggerimenti di una ricerca più
    // recente (risultati che sembrano sballati/lampeggianti).
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setQuery(value)
    setError('')
    setActiveIndex(-1)
    const parsed = parseInput(value)
    setParsedHouseNumber(parsed.houseNumber)
    if (!value || value.length < 2) {
      setSuggestions([])
      setSearched(false)
      return
    }
    const requestId = ++requestIdRef.current
    timeoutRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortControllerRef.current = controller
      setLoading(true)
      try {
        // Usiamo il testo "ripulito" dal civico (parsed.normalized) per la
        // ricerca, non il valore grezzo: un numero civico incastrato in
        // mezzo alla via e al comune (es. "Corso Umberto 1 Anzano di
        // Puglia") confonde Nominatim/Photon, che spesso non trovano nulla.
        // Il civico viene comunque riattaccato dopo, in handleSelect.
        const searchQuery = (parsed.normalized || value) + ', Italia'
        const results = await searchAddresses(searchQuery, { signal: controller.signal })
        // Se nel frattempo è partita una ricerca più recente, scartiamo
        // questo risultato (anche se la richiesta non fosse stata annullata
        // in tempo): evita di mostrare risultati fuori ordine.
        if (requestId !== requestIdRef.current) return
        const base = results.slice(0, 8)
        const enriched = await Promise.all(
          base.map((item, index) => {
            if (
              index === 0 &&
              !item.postcode &&
              item.lat != null &&
              item.lon != null
            ) {
              return enrichAddressWithCAP({ ...item }).catch(() => item)
            }
            return item
          })
        )
        if (requestId !== requestIdRef.current) return
        setSuggestions(enriched)
        setSearched(true)
      } catch (e) {
        if (requestId !== requestIdRef.current) return
        setSuggestions([])
        setSearched(true)
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    }, 250)
  }

  const handleKeyDown = (e) => {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setSuggestions([])
      setActiveIndex(-1)
    }
  }

  const handleSelect = (suggestion) => {
    const suggestionHouseNumber =
      (suggestion.housenumber && String(suggestion.housenumber).trim()) || ''
    const houseNumber =
      suggestionHouseNumber || (parsedHouseNumber && parsedHouseNumber.trim()) || ''
    let finalDisplay = suggestion.display || suggestion.street || ''
    if (
      houseNumber &&
      !finalDisplay.toLowerCase().includes(houseNumber.toLowerCase())
    ) {
      finalDisplay = `${finalDisplay} ${houseNumber}`
    }
    setDraftAddress({
      display: finalDisplay,
      street: suggestion.street || '',
      housenumber: houseNumber,
      city: suggestion.city || '',
      state: suggestion.state || suggestion.province || '',
      postcode: suggestion.postcode || '',
      lat: suggestion.lat,
      lon: suggestion.lon,
      country: 'Italia',
      source: 'landing-autocomplete'
    })
    setQuery(finalDisplay)
    setSuggestions([])
    setSearched(false)
    setActiveIndex(-1)
  }

  const handleSubmit = () => {
    if (!draftAddress || !draftAddress.display) {
      setError('Seleziona un indirizzo dai suggerimenti prima di procedere')
      return
    }
    onNext()
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-stretch">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Es. Via Benedetto Croce 297 Pescara"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-autocomplete="list"
              aria-controls="landing-address-suggestions"
              aria-activedescendant={activeIndex >= 0 ? `landing-suggestion-${activeIndex}` : undefined}
              className="w-full pl-11 pr-4 py-3 sm:py-4 bg-white border border-gray-200 rounded-2xl sm:rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-sm shadow-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            id="landing-submit-button"
            className="mt-3 sm:mt-0 sm:ml-3 rounded-2xl sm:rounded-3xl px-6 sm:px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center shadow-md shadow-blue-500/30 transition-colors"
          >
            <svg
              className="h-4 w-4 mr-2"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            VALUTA
          </button>
        </div>
        {loading && (
          <div className="absolute right-4 top-3 sm:top-3.5">
            <div className="h-4 w-4 border-b-2 border-blue-500 rounded-full animate-spin" />
          </div>
        )}
        {suggestions.length > 0 && (
          <div
            id="landing-address-suggestions"
            role="listbox"
            className="absolute z-10 mt-3 w-full bg-white border-b-2 border-l-2 border-r-2 border-t-0 border-slate-900 rounded-b-2xl shadow-[6px_6px_0_rgba(15,23,42,1)] max-h-60 overflow-auto scroll-thin px-2 py-2 space-y-2"
          >
            {suggestions.map((s, index) => (
              <button
                type="button"
                id={`landing-suggestion-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                key={index}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full rounded-xl border-2 border-slate-900 text-left px-4 py-2 text-sm flex flex-col items-start gap-0.5 transition-colors focus:outline-none focus:ring-0 focus:border-slate-900 ${
                  activeIndex === index
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-900 hover:bg-slate-900 hover:text-white'
                }`}
                onClick={() => handleSelect(s)}
              >
                <div className="font-medium">
                  {(() => {
                    const suggestionHouseNumber =
                      (s.housenumber && String(s.housenumber).trim()) || ''
                    const houseNumber =
                      suggestionHouseNumber ||
                      (parsedHouseNumber && parsedHouseNumber.trim()) ||
                      ''
                    let base = s.display || s.street || ''
                    if (
                      houseNumber &&
                      !base.toLowerCase().includes(houseNumber.toLowerCase())
                    ) {
                      base = `${base} ${houseNumber}`
                    }
                    return base
                  })()}
                </div>
                <div className="text-xs opacity-80">
                  {s.city || ''}
                  {s.postcode ? ` • ${s.postcode}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
        {searched && !loading && suggestions.length === 0 && query.length >= 2 && (
          <div className="absolute z-10 mt-3 w-full bg-white border-2 border-slate-900 rounded-2xl shadow-[6px_6px_0_rgba(15,23,42,1)] px-4 py-3 text-sm text-slate-600">
            Nessun indirizzo trovato. Prova a scrivere solo via e comune (es. "Corso Umberto, Anzano di Puglia"), senza il numero civico.
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}

export default AddressLanding
