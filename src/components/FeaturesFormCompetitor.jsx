import { useState, useRef, useEffect } from 'react'

export function AnimatedSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(() => {
    if (!options || options.length === 0) return -1
    const foundIndex = options.findIndex(option => option.value === value)
    return foundIndex === -1 ? 0 : foundIndex
  })
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = event => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (!options || options.length === 0) {
      setHighlightedIndex(-1)
      return
    }
    const foundIndex = options.findIndex(option => option.value === value)
    if (foundIndex !== -1) {
      setHighlightedIndex(foundIndex)
    }
  }, [value, options])

  const selectedOption = options.find(option => option.value === value)

  const handleToggle = () => {
    setOpen(prev => !prev)
  }

  const handleOptionSelect = (option, index) => {
    if (option.value !== value) {
      onChange(option.value)
    }
    setHighlightedIndex(index)
    setOpen(false)
  }

  const handleKeyDown = event => {
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(prev => !prev)
      return
    }

    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (!open) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex(prev => {
        if (!options || options.length === 0) return -1
        if (prev === -1) return 0
        const nextIndex = prev < options.length - 1 ? prev + 1 : 0
        return nextIndex
      })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex(prev => {
        if (!options || options.length === 0) return -1
        if (prev === -1) return options.length - 1
        const nextIndex = prev > 0 ? prev - 1 : options.length - 1
        return nextIndex
      })
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="w-full h-11 px-4 rounded-xl border-2 border-slate-900 text-sm bg-white text-slate-900 flex items-center justify-between focus:outline-none focus:ring-0 focus:border-slate-900"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedOption ? '' : 'text-slate-400'}>
          {selectedOption ? selectedOption.label : placeholder || 'Seleziona'}
        </span>
        <svg
          className={`h-4 w-4 text-slate-500 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.086l3.71-3.856a.75.75 0 111.08 1.04l-4.24 4.4a.75.75 0 01-1.08 0l-4.24-4.4a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div
        className={`absolute left-0 mt-1 w-full z-20 rounded-3xl border-2 border-slate-900 bg-white shadow-[6px_6px_0_rgba(15,23,42,1)] overflow-hidden transition-[max-height,opacity] duration-200 ${
          open
            ? 'max-h-64 opacity-100'
            : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <ul className="py-1 max-h-64 overflow-y-auto" role="listbox">
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isHighlighted = index === highlightedIndex
            return (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => handleOptionSelect(option, index)}
                  className={`w-full text-left px-4 py-2 text-sm ${
                    isHighlighted || isSelected
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function FeaturesFormCompetitor({
  propertyDraft,
  setPropertyDraft,
  wizardData,
  setWizardData,
  onNext,
  onBack
}) {
  const handleChange = (field, value) => {
    setPropertyDraft((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleFeatureChange = (field, value) => {
    setWizardData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [field]: value
      }
    }))
  }

  const toggleExtra = (field) => {
    setWizardData((prev) => ({
      ...prev,
      extra: {
        ...prev.extra,
        [field]: !prev.extra[field]
      }
    }))
  }

  // Aggiorna un valore numerico (non booleano) dentro wizardData.extra, usato
  // per i mq di terrazzo/giardino: questi mq vengono aggiunti (con un peso
  // percentuale) alla superficie usata per la valutazione.
  const handleExtraValueChange = (field, value) => {
    setWizardData((prev) => ({
      ...prev,
      extra: {
        ...prev.extra,
        [field]: value
      }
    }))
  }

  const handleContinue = () => {
    if (!propertyDraft.livingArea || propertyDraft.livingArea <= 0) {
      return
    }
    onNext()
  }

  // Tipologie con terreno proprio (non condominiale): giardino pesa meno in
  // proporzione (10% contro 15%) ed è l'unico gruppo per cui ha senso offrire
  // la piscina come caratteristica. Deve restare in sync con
  // VILLA_LIKE_PROPERTY_TYPES lato server (server/index.js).
  const isVillaLikeType = ['VILLA', 'VILLETTA A SCHIERA', 'RUSTICO/CASALE'].includes(
    String(wizardData.propertyType || '').toUpperCase()
  )
  const VILLA_FLOOR_VALUES = ['unico', 'due_livelli', 'tre_livelli']

  // Stabile/Palazzo: il campo "Piano" indica invece il numero di piani
  // dell'intero edificio, un concetto diverso dal piano di un singolo
  // appartamento. Dato informativo, nessun bonus/malus. Deve restare in
  // sync con isStabileType lato server.
  const isStabileType =
    String(wizardData.propertyType || '').toUpperCase() === 'STABILE/PALAZZO'
  const STABILE_FLOOR_VALUES = [
    'due_piani',
    'tre_piani',
    'quattro_piani',
    'cinque_piani_o_piu'
  ]

  // Mansarda: la superficie con altezza sotto 1,5m conta meno ai fini del
  // prezzo (convenzione catastale). Deve restare in sync con isMansardaType
  // lato server.
  const isMansardaType =
    String(wizardData.propertyType || '').toUpperCase() === 'MANSARDA'

  // Attico e Mansarda: nessun campo "Piano" da chiedere. L'attico si trova
  // per definizione sempre all'ultimo piano dello stabile (il backend usa
  // già piano 6 come piano "effettivo" per questa tipologia, vedi
  // isAtticoType in server/index.js), quindi il dato non va richiesto
  // all'utente. Stesso discorso per la mansarda, dove il piano non è un
  // dato significativo/richiesto.
  const isAtticoType =
    String(wizardData.propertyType || '').toUpperCase() === 'ATTICO'

  // Loft/Open space: l'altezza dei soffitti è la caratteristica distintiva e
  // dà un bonus se superiore allo standard. Deve restare in sync con
  // isLoftType lato server.
  const isLoftType =
    String(wizardData.propertyType || '').toUpperCase() === 'LOFT/OPEN SPACE'

  // Il campo "Piano" ha tre significati diversi in base alla tipologia:
  // posizione nel condominio (Appartamento e simili), numero di livelli
  // della villa stessa (Villa/Villetta/Rustico), oppure numero di piani
  // dell'intero edificio (Stabile/Palazzo). Se l'utente cambia tipologia
  // dopo aver già scelto un piano in un altro formato, il valore non ha
  // più senso: lo resettiamo al default corretto per evitare una
  // selezione incoerente.
  useEffect(() => {
    const currentIsVillaValue = VILLA_FLOOR_VALUES.includes(propertyDraft.floor)
    const currentIsStabileValue = STABILE_FLOOR_VALUES.includes(propertyDraft.floor)
    if (isVillaLikeType && !currentIsVillaValue) {
      handleChange('floor', 'unico')
    } else if (isStabileType && !currentIsStabileValue) {
      handleChange('floor', 'due_piani')
    } else if (
      !isVillaLikeType &&
      !isStabileType &&
      (currentIsVillaValue || currentIsStabileValue)
    ) {
      handleChange('floor', 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVillaLikeType, isStabileType])

  // Attico/Mansarda non hanno un campo "Piano" selezionabile: se l'utente
  // arriva da un'altra tipologia con un valore di piano già impostato (es.
  // "due_livelli" da Villa), lo azzeriamo per evitare di inviare un dato
  // incoerente al backend/report.
  useEffect(() => {
    if ((isAtticoType || isMansardaType) && propertyDraft.floor !== '') {
      handleChange('floor', '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAtticoType, isMansardaType])

  const isLivingAreaValid =
    propertyDraft.livingArea && propertyDraft.livingArea > 0

  const inputClass =
    'w-full h-11 px-4 rounded-xl border-2 border-slate-900 text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-slate-900'

  return (
    <div className="w-full max-w-3xl">
      <div className="text-xs font-semibold text-slate-700 uppercase tracking-[0.18em] mb-2">
        PASSAGGIO 2 DI 4
      </div>
      <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
        Indica le caratteristiche
      </h2>
      <p className="mt-3 text-sm text-gray-700 max-w-xl">
        Specifica i dati principali dell&apos;immobile: superficie, locali e qualità, così la stima sarà più precisa.
      </p>

      <div className="mt-8 rounded-3xl border-2 border-slate-900 bg-white px-6 py-6 shadow-[6px_6px_0_rgba(15,23,42,1)]">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
            <label className="text-sm font-semibold text-slate-900">
            Superficie *
          </label>
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-900">
                m²
              </div>
              <input
                type="number"
                min="0"
                value={propertyDraft.livingArea}
                onChange={(e) =>
                  handleChange(
                    'livingArea',
                    e.target.value ? parseFloat(e.target.value) : 0
                  )
                }
                className={inputClass + ' pl-12'}
                placeholder="Es. 110"
              />
            </div>
            {!isLivingAreaValid && (
              <div className="mt-1 text-xs text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-1.5">
                Inserisci la superficie dell&apos;immobile
              </div>
            )}
          </div>
        </div>

        {isMansardaType && (
          <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
            <label className="text-sm font-semibold text-slate-900">
              Soffitto basso
            </label>
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-semibold text-slate-900">
                  %
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={wizardData.features?.mansardaLowCeilingPercent ?? ''}
                  onChange={(e) =>
                    handleFeatureChange(
                      'mansardaLowCeilingPercent',
                      e.target.value ? parseFloat(e.target.value) : ''
                    )
                  }
                  className={inputClass + ' pr-10'}
                  placeholder="Es. 30"
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                % di superficie con altezza sotto 1,5m: viene conteggiata solo
                al 20% ai fini della valutazione (convenzione catastale).
              </div>
            </div>
          </div>
        )}

        {isLoftType && (
          <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
            <label className="text-sm font-semibold text-slate-900">
              Altezza soffitti
            </label>
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-semibold text-slate-900">
                  m
                </div>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={wizardData.features?.loftCeilingHeight ?? ''}
                  onChange={(e) =>
                    handleFeatureChange(
                      'loftCeilingHeight',
                      e.target.value ? parseFloat(e.target.value) : ''
                    )
                  }
                  className={inputClass + ' pr-10'}
                  placeholder="Es. 3.5"
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                Oltre lo standard di 2,70m: +5% di valore per ogni metro
                aggiuntivo (fino a un massimo del +10%).
              </div>
            </div>
          </div>
        )}

        {!isAtticoType && !isMansardaType && (
          <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
            <label className="text-sm font-semibold text-slate-900">
              {isVillaLikeType
                ? 'Livelli'
                : isStabileType
                  ? 'Piani dello stabile'
                  : 'Piano'}
            </label>
            {isVillaLikeType ? (
              <AnimatedSelect
                value={String(propertyDraft.floor)}
                onChange={val => handleChange('floor', val)}
                options={[
                  { value: 'unico', label: 'Villa su un livello' },
                  { value: 'due_livelli', label: 'Villa su due livelli' },
                  { value: 'tre_livelli', label: 'Villa su tre livelli o più' }
                ]}
              />
            ) : isStabileType ? (
              <AnimatedSelect
                value={String(propertyDraft.floor)}
                onChange={val => handleChange('floor', val)}
                options={[
                  { value: 'due_piani', label: 'Stabile di 2 piani' },
                  { value: 'tre_piani', label: 'Stabile di 3 piani' },
                  { value: 'quattro_piani', label: 'Stabile di 4 piani' },
                  { value: 'cinque_piani_o_piu', label: 'Stabile di 5 piani o più' }
                ]}
              />
            ) : (
              <AnimatedSelect
                value={String(propertyDraft.floor)}
                onChange={val =>
                  handleChange('floor', parseInt(val, 10))
                }
                options={[
                  { value: '0', label: 'Piano Terra' },
                  { value: '1', label: '1° Piano' },
                  { value: '2', label: '2° Piano' },
                  { value: '3', label: '3° Piano' },
                  { value: '4', label: '4° Piano' },
                  { value: '5', label: '5° Piano o superiore' },
                  { value: '6', label: 'Attico' }
                ]}
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
          <label className="text-sm font-semibold text-slate-900">
            Locali
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                handleFeatureChange(
                  'rooms',
                  Math.max(1, wizardData.features.rooms - 1)
                )
              }
              className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-slate-900 text-slate-900 bg-white hover:bg-slate-50"
            >
              −
            </button>
            <div className="w-10 text-center text-sm font-semibold text-slate-900">
              {wizardData.features.rooms}
            </div>
            <button
              type="button"
              onClick={() =>
                handleFeatureChange('rooms', wizardData.features.rooms + 1)
              }
              className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-slate-900 text-slate-900 bg-white hover:bg-slate-50"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
          <label className="text-sm font-semibold text-slate-900">Bagni/lavanderia</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                handleFeatureChange(
                  'bathrooms',
                  Math.max(1, wizardData.features.bathrooms - 1)
                )
              }
              className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-slate-900 text-slate-900 bg-white hover:bg-slate-50"
            >
              −
            </button>
            <div className="w-10 text-center text-sm font-semibold text-slate-900">
              {wizardData.features.bathrooms}
            </div>
            <button
              type="button"
              onClick={() =>
                handleFeatureChange(
                  'bathrooms',
                  wizardData.features.bathrooms + 1
                )
              }
              className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-slate-900 text-slate-900 bg-white hover:bg-slate-50"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
          <label className="text-sm font-semibold text-slate-900">
            Stato immobile
          </label>
          <AnimatedSelect
            value={propertyDraft.condition}
            onChange={val => handleChange('condition', val)}
            options={[
              { value: 'Da ristrutturare', label: 'Da ristrutturare' },
              { value: 'Buono', label: 'Buono' },
              { value: 'Ottimo', label: 'Ottimo' },
              { value: 'Nuovo', label: 'Nuovo' }
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
          <label className="text-sm font-semibold text-slate-900">
            Riscaldamento
          </label>
          <AnimatedSelect
            value={wizardData.features.heating}
            onChange={val => handleFeatureChange('heating', val)}
            placeholder="Seleziona"
            options={[
              { value: '', label: 'Seleziona' },
              { value: 'Autonomo', label: 'Autonomo' },
              { value: 'Centralizzato', label: 'Centralizzato' },
              { value: 'Altro', label: 'Altro' }
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
          <label className="text-sm font-semibold text-slate-900">
            Anno di costruzione
          </label>
          <div>
            <input
              type="text"
              value={wizardData.features.yearBuilt}
              onChange={(e) => handleFeatureChange('yearBuilt', e.target.value)}
              className={inputClass}
              placeholder="Inserisci la data esatta o approssimata"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
          <label className="text-sm font-semibold text-slate-900">
            Classe energetica
          </label>
          <AnimatedSelect
            value={wizardData.features.energyClass}
            onChange={val => handleFeatureChange('energyClass', val)}
            placeholder="Seleziona"
            options={[
              { value: '', label: 'Seleziona' },
              { value: 'A4', label: 'A4' },
              { value: 'A3', label: 'A3' },
              { value: 'A2', label: 'A2' },
              { value: 'A1', label: 'A1' },
              { value: 'A', label: 'A' },
              { value: 'B', label: 'B' },
              { value: 'C', label: 'C' },
              { value: 'D', label: 'D' },
              { value: 'E', label: 'E' },
              { value: 'F', label: 'F' },
              { value: 'G', label: 'G' },
              { value: 'NON_SO', label: 'Non lo so' }
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px,minmax(0,1fr)] md:items-center gap-2 md:gap-4">
          <label className="text-sm font-semibold text-slate-900">
            Ascensore
          </label>
          <div>
            <div className="inline-flex rounded-full border-2 border-slate-900 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => handleChange('hasElevator', true)}
                className={`px-4 h-9 text-xs sm:text-sm font-semibold ${
                  propertyDraft.hasElevator
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-900 bg-white'
                }`}
              >
                Sì
              </button>
              <button
                type="button"
                onClick={() => handleChange('hasElevator', false)}
                className={`px-4 h-9 text-xs sm:text-sm font-semibold ${
                  !propertyDraft.hasElevator
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-900 bg-white'
                }`}
              >
                NO
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <button
              type="button"
              onClick={() => toggleExtra('hasBalconyOrTerrace')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
                wizardData.extra.hasBalconyOrTerrace
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-900 bg-white text-slate-900'
              }`}
            >
              <span>Terrazzo e balcone</span>
              <span className="font-semibold">
                {wizardData.extra.hasBalconyOrTerrace ? 'Sì' : 'No'}
              </span>
            </button>
            {wizardData.extra.hasBalconyOrTerrace && (
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-900">
                  m²
                </div>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={wizardData.extra.terraceArea ?? ''}
                  onChange={(e) =>
                    handleExtraValueChange(
                      'terraceArea',
                      e.target.value ? parseFloat(e.target.value) : ''
                    )
                  }
                  className={inputClass + ' pl-12'}
                  placeholder="Mq terrazzo/balcone"
                />
                <div className="mt-1 text-[11px] text-slate-600">
                  Il 30% di questi mq viene aggiunto alla superficie ai fini
                  della valutazione.
                </div>
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => toggleExtra('hasGarden')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
                wizardData.extra.hasGarden
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-900 bg-white text-slate-900'
              }`}
            >
              <span>Giardino</span>
              <span className="font-semibold">
                {wizardData.extra.hasGarden ? 'Sì' : 'No'}
              </span>
            </button>
            {wizardData.extra.hasGarden && (
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-900">
                  m²
                </div>
                <input
                  type="number"
                  min="0"
                  max="2000"
                  value={wizardData.extra.gardenArea ?? ''}
                  onChange={(e) =>
                    handleExtraValueChange(
                      'gardenArea',
                      e.target.value ? parseFloat(e.target.value) : ''
                    )
                  }
                  className={inputClass + ' pl-12'}
                  placeholder="Mq giardino"
                />
                <div className="mt-1 text-[11px] text-slate-600">
                  Il {isVillaLikeType ? '10' : '15'}% di questi mq (dimezzato
                  oltre i 25 mq) viene aggiunto alla superficie ai fini della
                  valutazione.
                </div>
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => toggleExtra('hasCantina')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
                wizardData.extra.hasCantina
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-900 bg-white text-slate-900'
              }`}
            >
              <span>Cantina</span>
              <span className="font-semibold">
                {wizardData.extra.hasCantina ? 'Sì' : 'No'}
              </span>
            </button>
            {wizardData.extra.hasCantina && (
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-900">
                  m²
                </div>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={wizardData.extra.cantinaArea ?? ''}
                  onChange={(e) =>
                    handleExtraValueChange(
                      'cantinaArea',
                      e.target.value ? parseFloat(e.target.value) : ''
                    )
                  }
                  className={inputClass + ' pl-12'}
                  placeholder="Mq cantina"
                />
                <div className="mt-1 text-[11px] text-slate-600">
                  Il 25% di questi mq viene aggiunto alla superficie ai fini
                  della valutazione.
                </div>
              </div>
            )}
          </div>
          {isVillaLikeType && (
            <button
              type="button"
              onClick={() => toggleExtra('hasPiscina')}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
                wizardData.extra.hasPiscina
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-900 bg-white text-slate-900'
              }`}
            >
              <span>Piscina</span>
              <span className="font-semibold">
                {wizardData.extra.hasPiscina ? 'Sì' : 'No'}
              </span>
            </button>
          )}
          <div>
            <button
              type="button"
              onClick={() => toggleExtra('hasGarage')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
                wizardData.extra.hasGarage
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-900 bg-white text-slate-900'
              }`}
            >
              <span>Garage/posto auto</span>
              <span className="font-semibold">
                {wizardData.extra.hasGarage ? 'Sì' : 'No'}
              </span>
            </button>
            {wizardData.extra.hasGarage && (
              <div className="mt-2 text-[11px] text-slate-600">
                Il garage/posto auto non viene valutato economicamente: dati
                non pervenuti. Viene comunque segnalato come caratteristica
                dell&apos;immobile.
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => toggleExtra('zonaDiPregio')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
                wizardData.extra.zonaDiPregio
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-900 bg-white text-slate-900'
              }`}
            >
              <span>Zona di pregio</span>
              <span className="font-semibold">
                {wizardData.extra.zonaDiPregio ? 'Sì' : 'No'}
              </span>
            </button>
            {wizardData.extra.zonaDiPregio && (
              <div className="mt-1 text-[11px] text-slate-600">
                Es. centro storico di una grande città: annulla i malus di età,
                stato di conservazione, assenza ascensore e mansarda, ma
                limita il bonus complessivo a un tetto massimo (spiegato nel
                report).
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t-2 border-slate-900 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs sm:text-sm font-semibold text-slate-900 hover:underline"
        >
          Indietro
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-xs sm:text-sm font-semibold ${
            isLivingAreaValid
              ? 'bg-slate-900 text-white shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-slate-800'
              : 'bg-slate-300 text-slate-600 cursor-not-allowed'
          }`}
        >
          Prosegui
        </button>
      </div>
      </div>
    </div>
  )
}

export default FeaturesFormCompetitor
