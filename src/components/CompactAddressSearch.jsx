import { useState, useRef, useEffect } from 'react'
import { searchAddresses, enrichAddressWithCAP } from '../services/enhancedAddressService.js'

// Campo di ricerca indirizzo compatto con autocomplete, usato per indirizzi
// "secondari" (es. garage/posto auto separato dall'abitazione) dove non
// serve il flusso completo con numero civico e mappa: basta un CAP/comune
// per poter interrogare i valori OMI di quella zona.
function CompactAddressSearch({ value, onChange, placeholder }) {
  const [query, setQuery] = useState(value?.display || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)

    if (!val || val.trim() === '') {
      onChange(null)
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (val.trim().length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await searchAddresses(val)
        setSuggestions(results || [])
        setShowSuggestions((results || []).length > 0)
      } catch (err) {
        console.error('Errore ricerca indirizzo garage:', err)
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoading(false)
      }
    }, 350)
  }

  const handleSelect = async (suggestion) => {
    setShowSuggestions(false)
    setLoading(true)
    try {
      const enriched = await enrichAddressWithCAP({ ...suggestion })
      setQuery(enriched.display || enriched.street || query)
      onChange(enriched)
    } catch (err) {
      console.error('Errore arricchimento indirizzo garage:', err)
      onChange(suggestion)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder={placeholder || 'Cerca indirizzo...'}
        autoComplete="off"
        className="w-full h-11 px-4 rounded-xl border-2 border-slate-900 text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-slate-900"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_rgba(15,23,42,1)]">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={i}
              onClick={() => handleSelect(s)}
              className="block w-full border-b border-slate-100 px-4 py-2 text-left text-sm last:border-b-0 hover:bg-slate-100"
            >
              <div className="font-medium text-slate-900">{s.display}</div>
              {s.postcode && (
                <div className="text-xs text-slate-500">CAP: {s.postcode}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CompactAddressSearch
