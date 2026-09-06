import { useState, useEffect, useRef } from 'react'
import { searchAddresses, enrichAddressWithCAP, findPreciseCoordinates } from '../services/enhancedAddressService.js'

function AddressSearch({ onAddressSelect }) {
  const [query, setQuery] = useState('')
  const [houseNumber, setHouseNumber] = useState('')
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchStats, setSearchStats] = useState(null)
  const suggestionsRef = useRef(null)
  const timeoutRef = useRef(null)

  // Gestisce il click fuori dal componente per chiudere i suggerimenti
  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Funzione per cercare indirizzi tramite il servizio avanzato
  const performAddressSearch = async (input) => {
    if (!input || input.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      setSearchStats(null)
      return
    }

    setLoading(true)
    setErrorMessage('')
    
    try {
      console.log('🔍 Ricerca avanzata per:', input)
      const startTime = Date.now()
      
      // Utilizza il servizio avanzato che combina più fonti
      const results = await searchAddresses(input)
      
      const endTime = Date.now()
      const searchTime = endTime - startTime
      
      console.log(`✅ Trovati ${results.length} risultati in ${searchTime}ms`)
      
      // Aggiorna le statistiche di ricerca
      setSearchStats({
        resultCount: results.length,
        searchTime: searchTime,
        sources: [...new Set(results.map(r => r.source))].join(', ')
      })
      
      if (results.length === 0) {
        setSuggestions([])
        setErrorMessage(`Nessun risultato trovato per "${input}". Prova a scrivere in modo diverso o verifica l'ortografia.`)
        setShowSuggestions(false)
      } else {
        setSuggestions(results)
        setShowSuggestions(true)
        setErrorMessage('')
      }
      
    } catch (error) {
      console.error('❌ Errore nella ricerca indirizzi:', error)
      setSuggestions([])
      setShowSuggestions(false)
      setErrorMessage('Si è verificato un errore durante la ricerca. Riprova tra qualche secondo.')
    } finally {
      setLoading(false)
    }
  }

  // Gestisce il cambio del testo di input con debounce
  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)
    
    // Cancella il timeout precedente se esiste
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    if (value.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      setSearchStats(null)
      return
    }
    
    // Debounce per evitare troppe richieste
    timeoutRef.current = setTimeout(() => {
      performAddressSearch(value)
    }, 300)
  }

  // Gestisce la selezione di un indirizzo dalla lista
  const handleSelectAddress = async (address) => {
    setErrorMessage('')
    setShowSuggestions(false)
    setLoading(true)
    
    try {
      console.log('📍 Indirizzo selezionato:', address)
      
      // Arricchisci l'indirizzo con informazioni CAP se mancanti
      const enrichedAddress = await enrichAddressWithCAP(address)
      setSelectedAddress(enrichedAddress)
      
      // Imposta il campo di ricerca con l'indirizzo selezionato
      setQuery(enrichedAddress.street || enrichedAddress.display.split(',')[0])
      
      // Se l'indirizzo ha già un numero civico, precompiliamo il campo
      if (enrichedAddress.housenumber && enrichedAddress.housenumber.trim() !== '') {
        setHouseNumber(enrichedAddress.housenumber)
      } else {
        setHouseNumber('')
      }
      
      console.log('✅ Indirizzo arricchito:', enrichedAddress)
      
    } catch (error) {
      console.error('❌ Errore nell\'arricchimento indirizzo:', error)
      setErrorMessage('Errore nell\'elaborazione dell\'indirizzo selezionato.')
    } finally {
      setLoading(false)
    }
  }
  
  // Gestisce la conferma dell'indirizzo completo (con numero civico)
  const handleConfirmAddress = async () => {
    if (!selectedAddress) {
      setErrorMessage('Seleziona prima un indirizzo dalla lista')
      return
    }
    
    if (!houseNumber || houseNumber.trim() === '') {
      setErrorMessage('È necessario inserire un numero civico valido per procedere')
      return
    }
    
    setLoading(true)
    setErrorMessage('')
    
    try {
      // Crea una copia dell'indirizzo selezionato con il numero civico aggiornato
      const completeAddress = { ...selectedAddress }
      completeAddress.housenumber = houseNumber.trim()
      
      // Aggiorna anche il display dell'indirizzo
      if (completeAddress.street) {
        completeAddress.display = `${completeAddress.street} ${completeAddress.housenumber}, ${completeAddress.city || ''}`
      }
      
      console.log('🎯 Ricerca coordinate precise per indirizzo completo')
      
      // Cerca coordinate più precise con il numero civico
      const finalAddress = await findPreciseCoordinates(completeAddress)
      
      // Arricchisci nuovamente con informazioni CAP se necessario
      const enrichedFinalAddress = await enrichAddressWithCAP(finalAddress)
      
      console.log('✅ Indirizzo finale confermato:', enrichedFinalAddress)
      
      // Procedi con la selezione dell'indirizzo
      onAddressSelect(enrichedFinalAddress)
      
    } catch (error) {
      console.error('❌ Errore nella conferma indirizzo:', error)
      setErrorMessage('Errore nella conferma dell\'indirizzo. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  // Componente per visualizzare le statistiche di ricerca (solo in sviluppo)
  const SearchStats = ({ stats }) => {
    if (!stats || process.env.NODE_ENV === 'production') return null
    
    return (
      <div className="text-xs text-gray-400 mt-1 px-2">
        {stats.resultCount} risultati in {stats.searchTime}ms da: {stats.sources}
      </div>
    )
  }

  return (
    <div className="relative w-full" ref={suggestionsRef}>
      <div className="flex space-x-2 mb-2">
        <div className="relative flex-grow">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (query.length >= 2 && suggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            placeholder="Inserisci l'indirizzo dell'immobile (min. 2 caratteri)"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoComplete="off"
            disabled={loading}
          />
          {loading && (
            <div className="absolute right-3 top-2.5">
              <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
          <SearchStats stats={searchStats} />
        </div>
        
        <div className="w-1/4">
          <input
            type="text"
            value={houseNumber}
            onChange={(e) => setHouseNumber(e.target.value)}
            placeholder="N° civico *"
            className={`w-full px-4 py-2 border ${!houseNumber && selectedAddress ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            disabled={!selectedAddress || loading}
          />
        </div>
        
        <div className="w-1/6">
          <button
            onClick={handleConfirmAddress}
            disabled={!selectedAddress || loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '...' : 'Conferma'}
          </button>
        </div>
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg max-h-80 overflow-auto border border-gray-200">
          <ul className="py-1">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                onClick={() => handleSelectAddress(suggestion)}
                className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">
                  {suggestion.display}
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                  <span>
                    {suggestion.source && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                        {suggestion.source}
                      </span>
                    )}
                    {suggestion.postcode && <span>CAP: {suggestion.postcode}</span>}
                  </span>
                  {suggestion.confidence && (
                    <span className="text-green-600">
                      ★ {Math.round(suggestion.confidence * 100)}%
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {query.length >= 2 && !loading && suggestions.length === 0 && !errorMessage && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg p-4 border border-gray-200">
          <div className="text-center">
            <div className="text-gray-500 text-sm mb-2">
              🔍 Nessun risultato immediato trovato
            </div>
            <div className="text-xs text-gray-400">
              Il sistema ha cercato in database locali e servizi esterni. 
              Prova a scrivere l&apos;indirizzo in modo diverso o verifica l&apos;ortografia.
            </div>
          </div>
        </div>
      )}
      
      {errorMessage && (
        <div className="mt-2 p-3 border border-red-300 bg-red-50 rounded-md">
          <p className="text-sm text-red-600">{errorMessage}</p>
          <div className="text-xs text-red-500 mt-1">
            💡 Suggerimenti: Prova a scrivere solo il nome della via, oppure aggiungi il nome della città
          </div>
        </div>
      )}
      
      {selectedAddress && selectedAddress.cap_valid === false && (
        <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded-md">
          <p className="text-sm text-yellow-700">
            ⚠️ CAP non riconosciuto per questo indirizzo. La valutazione potrebbe essere meno precisa.
          </p>
        </div>
      )}
      
      {selectedAddress && selectedAddress.reliability && (
        <div className="mt-2 p-2 bg-blue-50 rounded-md">
          <div className="text-xs text-blue-600">
            📊 Affidabilità dati: {selectedAddress.reliability}
            {selectedAddress.precision && ` | Precisione: ${selectedAddress.precision}`}
          </div>
        </div>
      )}
    </div>
  )
}

export default AddressSearch
