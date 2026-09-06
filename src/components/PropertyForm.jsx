import { useState } from 'react'

function PropertyForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    livingArea: 75,
    balconyArea: 0,
    terraceArea: 0,
    verandaArea: 0,
    loftArea: 0,
    atticArea: 0,
    basementArea: 0,
    gardenArea: 0,
    rooftopArea: 0,
    condition: 'Buono',
    floor: 1,
    hasElevator: false
  })
  
  const [errors, setErrors] = useState({})
  const [currentSection, setCurrentSection] = useState(1)

  const sections = [
    { id: 1, title: 'Superfici Principali', icon: '🏠' },
    { id: 2, title: 'Superfici Aggiuntive', icon: '📐' },
    { id: 3, title: 'Caratteristiche', icon: '⚙️' }
  ]

  // Gestisce i cambiamenti dei campi
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Rimuovi errori quando l'utente corregge
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  // Validazione
  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.livingArea || formData.livingArea < 10) {
      newErrors.livingArea = 'La superficie abitabile deve essere almeno 10 mq'
    }
    
    if (formData.livingArea > 500) {
      newErrors.livingArea = 'La superficie abitabile non può superare 500 mq'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Invio del form
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  // Superficie totale calcolata
  const totalArea = Object.keys(formData)
    .filter(key => key.includes('Area'))
    .reduce((sum, key) => sum + (parseFloat(formData[key]) || 0), 0)

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header con sezioni */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setCurrentSection(section.id)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg mx-1 transition-colors ${
                currentSection === section.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">{section.icon} </span>
              {section.title}
            </button>
          ))}
        </div>
        
        {/* Indicatore superficie totale */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-3 border border-blue-200">
          <div className="text-sm text-gray-600">Superficie totale:</div>
          <div className="text-xl font-bold text-gray-800">{totalArea} mq</div>
        </div>
      </div>

      {/* Sezione 1: Superfici Principali */}
      {currentSection === 1 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            🏠 Superfici Principali
          </h3>
          
          {/* Superficie abitabile - OBBLIGATORIA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Superficie abitabile (mq) *
            </label>
            <input
              type="number"
              value={formData.livingArea}
              onChange={(e) => handleChange('livingArea', parseFloat(e.target.value) || 0)}
              min="10"
              max="500"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent text-xl text-center ${
                errors.livingArea 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="es. 75"
            />
            {errors.livingArea && (
              <p className="mt-1 text-sm text-red-600">{errors.livingArea}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Include soggiorno, cucina, camere da letto, bagni, corridoi
            </p>
          </div>

          {/* Balconi e Terrazzi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🌿 Balconi (mq)
              </label>
              <input
                type="number"
                value={formData.balconyArea}
                onChange={(e) => handleChange('balconyArea', parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">Valore: 30% del prezzo al mq</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏖️ Terrazzi (mq)
              </label>
              <input
                type="number"
                value={formData.terraceArea}
                onChange={(e) => handleChange('terraceArea', parseFloat(e.target.value) || 0)}
                min="0"
                max="200"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">Valore: 35% del prezzo al mq</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setCurrentSection(2)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continua →
            </button>
          </div>
        </div>
      )}

      {/* Sezione 2: Superfici Aggiuntive */}
      {currentSection === 2 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            📐 Superfici Aggiuntive <span className="text-sm font-normal text-gray-500 ml-2">(opzionali)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🪟 Verande (mq)
              </label>
              <input
                type="number"
                value={formData.verandaArea}
                onChange={(e) => handleChange('verandaArea', parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">Valore: 50% del prezzo al mq</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏗️ Soppalchi (mq)
              </label>
              <input
                type="number"
                value={formData.loftArea}
                onChange={(e) => handleChange('loftArea', parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">Valore: 70% del prezzo al mq</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏠 Mansarde (mq)
              </label>
              <input
                type="number"
                value={formData.atticArea}
                onChange={(e) => handleChange('atticArea', parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">Valore: 60% del prezzo al mq</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏘️ Seminterrati (mq)
              </label>
              <input
                type="number"
                value={formData.basementArea}
                onChange={(e) => handleChange('basementArea', parseFloat(e.target.value) || 0)}
                min="0"
                max="200"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">Valore: 50% del prezzo al mq</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🌳 Giardini (mq)
              </label>
              <input
                type="number"
                value={formData.gardenArea}
                onChange={(e) => handleChange('gardenArea', parseFloat(e.target.value) || 0)}
                min="0"
                max="500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">Valore: 15% del prezzo al mq</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏢 Lastrici solari (mq)
              </label>
              <input
                type="number"
                value={formData.rooftopArea}
                onChange={(e) => handleChange('rooftopArea', parseFloat(e.target.value) || 0)}
                min="0"
                max="200"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">Valore: 20% del prezzo al mq</p>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentSection(1)}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Indietro
            </button>
            <button
              onClick={() => setCurrentSection(3)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continua →
            </button>
          </div>
        </div>
      )}

      {/* Sezione 3: Caratteristiche */}
      {currentSection === 3 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            ⚙️ Caratteristiche dell&apos;immobile
          </h3>

          {/* Stato dell'immobile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stato dell&apos;immobile *
            </label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: 'Nuovo', label: '✨ Nuovo', desc: 'Ottimo stato, appena costruito o ristrutturato', multiplier: '+15%' },
                { value: 'Buono', label: '👍 Buono', desc: 'Buone condizioni, necessita manutenzione ordinaria', multiplier: '0%' },
                { value: 'Da ristrutturare', label: '🔨 Da ristrutturare', desc: 'Necessita lavori di ristrutturazione', multiplier: '-25%' }
              ].map(option => (
                <label key={option.value} className="relative">
                  <input
                    type="radio"
                    name="condition"
                    value={option.value}
                    checked={formData.condition === option.value}
                    onChange={(e) => handleChange('condition', e.target.value)}
                    className="sr-only"
                  />
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.condition === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-800">{option.label}</div>
                        <div className="text-sm text-gray-600 mt-1">{option.desc}</div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        option.multiplier.includes('+') ? 'bg-green-100 text-green-800' :
                        option.multiplier.includes('-') ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {option.multiplier}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Piano *
            </label>
            <select
              value={formData.floor}
              onChange={(e) => handleChange('floor', parseInt(e.target.value))}
              className="w-full h-11 px-4 rounded-xl border-2 border-slate-900 text-sm bg-white text-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900 appearance-none"
            >
              <option value={0}>Piano Terra</option>
              <option value={1}>1° Piano</option>
              <option value={2}>2° Piano</option>
              <option value={3}>3° Piano</option>
              <option value={4}>4° Piano</option>
              <option value={5}>5° Piano o superiore</option>
            </select>
          </div>

          {/* Ascensore */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasElevator}
                onChange={(e) => handleChange('hasElevator', e.target.checked)}
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="font-medium text-gray-800">🛗 Ascensore presente</div>
                <div className="text-sm text-gray-600">
                  {formData.floor > 2 && !formData.hasElevator 
                    ? '⚠️ Piano alto senza ascensore: -8% del valore'
                    : formData.floor > 0 && formData.hasElevator
                    ? '✅ Bonus piano rialzato con ascensore: +3%'
                    : 'Influisce sulla valutazione per piani superiori al 2°'
                  }
                </div>
              </div>
            </label>
          </div>

          {/* Riepilogo e invio */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
            <h4 className="font-semibold text-gray-800 mb-3">📋 Riepilogo</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-600">Superficie abitabile:</div>
              <div className="font-medium">{formData.livingArea} mq</div>
              
              <div className="text-gray-600">Superficie totale:</div>
              <div className="font-medium">{totalArea} mq</div>
              
              <div className="text-gray-600">Stato:</div>
              <div className="font-medium">{formData.condition}</div>
              
              <div className="text-gray-600">Piano:</div>
              <div className="font-medium">
                {formData.floor === 0 ? 'Terra' : `${formData.floor}°`}
                {formData.hasElevator && ' (con ascensore)'}
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentSection(2)}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Indietro
            </button>
            <button
              onClick={handleSubmit}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center"
            >
              🚀 Calcola Valutazione
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PropertyForm
