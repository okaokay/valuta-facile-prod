import { useState, useEffect, useRef } from 'react'
import { searchAddresses, enrichAddressWithCAP } from '../services/enhancedAddressService.js'

function StepByStepAddressForm({ onAddressSelect, simplified = false }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    city: '',
    province: '',
    street: '',
    houseNumber: '',
    cap: ''
  })
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const timeoutRef = useRef(null)
  const suggestionsRef = useRef(null)
  
  // Gestisce il click fuori dal componente per chiudere i suggerimenti
  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setSuggestions([])
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Ricerca città italiane
  const searchCities = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      console.log('🔍 Ricerca città:', query)
      const results = await searchAddresses(query + ', Italia')
      console.log('✅ Risultati città:', results)
      
      const cities = results
        .filter(result => result.city || result.display)
        .slice(0, 8) // Limita a 8 risultati
      
      setSuggestions(cities)
      console.log('🏙️ Suggerimenti città impostati:', cities)
    } catch (error) {
      console.error('❌ Errore ricerca città:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  // Ricerca vie per la città selezionata - VERSIONE MIGLIORATA
  const searchStreets = async (query) => {
    if (!query || query.length < 2 || !formData.city) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      console.log('🔍 Ricerca vie:', query)
      
      // Costruisci la query in modo più efficace per trovare vie
      let fullQuery = query;
      
      // Aggiungi la città solo se non è già inclusa nella query
      if (!query.toLowerCase().includes(formData.city.toLowerCase())) {
        fullQuery = `${query}, ${formData.city}`;
      }
      
      // Aggiungi Italia se non già inclusa
      if (!fullQuery.toLowerCase().includes('italia')) {
        fullQuery += ', Italia';
      }
      
      console.log('🔍 Query completa:', fullQuery);
      const results = await searchAddresses(fullQuery)
      console.log('✅ Risultati vie:', results)
      
      // Filtra i risultati per mostrare solo quelli pertinenti
      const streets = results
        .filter(result => {
          // Accetta risultati con street esplicito o con display che inizia con la query
          return result.street || 
                 (result.display && result.display.toLowerCase().includes(query.toLowerCase()));
        })
        .slice(0, 8);
      
      setSuggestions(streets)
      console.log('🛣️ Suggerimenti vie impostati:', streets)
    } catch (error) {
      console.error('❌ Errore ricerca vie:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  // Gestisce input con debounce
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrorMessage('')

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (field === 'city' && currentStep === 1) {
      timeoutRef.current = setTimeout(() => searchCities(value), 300)
    } else if (field === 'street' && currentStep === 3) {
      timeoutRef.current = setTimeout(() => searchStreets(value), 300)
    }
  }

  // Selezione da suggerimenti - MIGLIORATA
  const handleSelectSuggestion = (suggestion) => {
    console.log('🎯 Suggerimento selezionato:', suggestion)
    
    if (currentStep === 1) {
      // Selezione città
      setFormData(prev => ({
        ...prev,
        city: suggestion.city || suggestion.display.split(',')[0].trim(),
        province: suggestion.state || suggestion.province || suggestion.display.split(',')[1]?.trim() || 'N/A',
        cap: suggestion.postcode || suggestion.cap || ''
      }))
      setSuggestions([])
      setCurrentStep(2)
    } else if (currentStep === 3) {
      // Selezione via - MIGLIORATA
      const streetName = suggestion.street || suggestion.display.split(',')[0].trim();
      
      // Estrai il CAP se presente
      const cap = suggestion.postcode || suggestion.cap || formData.cap;
      
      setFormData(prev => ({
        ...prev,
        street: streetName,
        cap: cap
      }))
      
      console.log(`✅ Via selezionata: ${streetName}, CAP: ${cap}`);
      
      setSuggestions([])
      setCurrentStep(4)
    }
  }

  // Avanza al prossimo step
  const nextStep = () => {
    setErrorMessage('')
    
    if (currentStep === 1 && !formData.city) {
      setErrorMessage('Seleziona una città dalla lista')
      return
    }
    if (currentStep === 2) {
      setCurrentStep(3)
      return
    }
    if (currentStep === 3 && !formData.street) {
      setErrorMessage('Inserisci il nome della via')
      return
    }
    if (currentStep === 4 && !formData.houseNumber) {
      setErrorMessage('Inserisci il numero civico')
      return
    }
    if (currentStep === 4) {
      setCurrentStep(5)
      return
    }
  }

  // Torna indietro
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setSuggestions([])
      setErrorMessage('')
    }
  }

  // Conferma finale - MIGLIORATA
  const confirmAddress = async () => {
    setLoading(true)
    try {
      const completeAddress = {
        display: `${formData.street} ${formData.houseNumber}, ${formData.city}, ${formData.province}`,
        street: formData.street,
        housenumber: formData.houseNumber,
        city: formData.city,
        state: formData.province,
        postcode: formData.cap,
        country: 'Italia',
        source: 'step-by-step-form'
      }

      console.log('🔍 Arricchimento indirizzo con CAP:', completeAddress);
      
      // Arricchisci l'indirizzo con informazioni CAP
      const enrichedAddress = await enrichAddressWithCAP(completeAddress);
      
      console.log('✅ Indirizzo arricchito:', enrichedAddress);
      
      // Assicurati che il CAP sia presente
      if (!enrichedAddress.postcode && formData.cap) {
        enrichedAddress.postcode = formData.cap;
      }
      
      onAddressSelect(enrichedAddress)
    } catch (error) {
      console.error('❌ Errore nella conferma indirizzo:', error);
      setErrorMessage('Errore nella conferma dell\'indirizzo')
    } finally {
      setLoading(false)
    }
  }

  // Renderizza il form in base allo step corrente
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="relative">
            <div className="flex items-center">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Inserisci il nome della città..."
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            {suggestions.length > 0 && (
              <div 
                ref={suggestionsRef}
                className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto border border-gray-200"
              >
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-left"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    <div className="font-medium">{suggestion.city || suggestion.display.split(',')[0]}</div>
                    <div className="text-xs text-gray-500">
                      {suggestion.state || suggestion.display.split(',')[1] || 'Italia'}
                      {suggestion.postcode ? ` - ${suggestion.postcode}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      
      case 2:
        return (
          <div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Città selezionata</label>
                <button
                  type="button"
                  onClick={prevStep}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Modifica
                </button>
              </div>
              <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-md">
                <span className="font-medium">{formData.city}</span>
                {formData.province && <span className="text-blue-600 ml-1">({formData.province})</span>}
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="text"
                placeholder="Provincia"
                value={formData.province}
                onChange={(e) => handleInputChange('province', e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={nextStep}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-r-md transition duration-150 ease-in-out"
              >
                Avanti
              </button>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Città</label>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Modifica
                </button>
              </div>
              <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm">
                {formData.city}, {formData.province}
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Inserisci il nome della via..."
                  value={formData.street}
                  onChange={(e) => handleInputChange('street', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={prevStep}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 border border-gray-300 rounded-none transition duration-150 ease-in-out"
              >
                ←
              </button>
            </div>
            {suggestions.length > 0 && (
              <div 
                ref={suggestionsRef}
                className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto border border-gray-200"
              >
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-left"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    <div className="font-medium">
                      {suggestion.street || suggestion.display.split(',')[0]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {suggestion.city || suggestion.display.split(',')[1] || formData.city}
                      {suggestion.postcode ? ` - ${suggestion.postcode}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      
      case 4:
        return (
          <div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Via</label>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Modifica
                </button>
              </div>
              <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm">
                {formData.street}, {formData.city}
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                type="text"
                placeholder="Numero civico"
                value={formData.houseNumber}
                onChange={(e) => handleInputChange('houseNumber', e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={nextStep}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-r-md transition duration-150 ease-in-out"
              >
                Avanti
              </button>
            </div>
          </div>
        );
      
      case 5:
        return (
          <div>
            <div className="mb-4">
              <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-md">
                <div className="font-medium">
                  {formData.street} {formData.houseNumber}
                </div>
                <div>
                  {formData.city}, {formData.province}
                  {formData.cap && ` - ${formData.cap}`}
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              <button
                type="button"
                onClick={prevStep}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-l-md hover:bg-gray-50"
              >
                Modifica
              </button>
              <button
                type="button"
                onClick={confirmAddress}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-r-md transition duration-150 ease-in-out"
              >
                Valuta
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Se è richiesta la versione semplificata, mostra solo l'input iniziale
  if (simplified) {
    return (
      <input
        type="text"
        placeholder="Inserisci il tuo indirizzo..."
        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    );
  }

  return (
    <div className="relative">
      {renderStepContent()}
      
      {errorMessage && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          ⚠️ {errorMessage}
        </div>
      )}
      
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

export default StepByStepAddressForm 
