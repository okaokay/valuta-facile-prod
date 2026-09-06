function PropertyTypeCards({ value, onChange, onNext, onBack }) {
  const types = [
    'APPARTAMENTO',
    'VILLA',
    'LOFT/OPEN SPACE',
    'MANSARDA',
    'STABILE/PALAZZO',
    'RUSTICO/CASALE',
    'ATTICO',
    'VILLETTA A SCHIERA'
  ]

  const handleNext = () => {
    if (!value) {
      return
    }
    onNext()
  }

  // Selezionare una card seleziona la tipologia e avanza subito al passaggio
  // successivo, senza dover premere "Prosegui": velocizza il wizard dato che
  // qui non c'è altro da inserire oltre alla scelta della tipologia.
  const handleSelect = (type) => {
    onChange(type)
    onNext()
  }

  const getIcon = (type, selected) => {
    const common = 'w-[22px] h-[22px] flex-shrink-0'
    const color = selected ? '#2563eb' : '#374151'

    const props = {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      className: common,
      stroke: color,
      fill: 'none',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }

    switch (type) {
      case 'APPARTAMENTO':
        return (
          <svg {...props}>
            <rect x="4" y="3" width="16" height="18" rx="1.5" />
            <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
          </svg>
        )
      case 'VILLA':
        return (
          <svg {...props}>
            <path d="M3 11 12 4l9 7" />
            <path d="M5 10v10h14V10" />
            <path d="M9 20v-5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5" />
            <path d="M7 13h2M15 13h2" />
          </svg>
        )
      case 'LOFT/OPEN SPACE':
        return (
          <svg {...props}>
            <rect x="4" y="5" width="16" height="14" rx="1.5" />
            <path d="M8 9h8M8 13h4" />
          </svg>
        )
      case 'MANSARDA':
        return (
          <svg {...props}>
            <path d="M4 11 12 4l8 7" />
            <path d="M7 11v7h10v-7" />
            <path d="M10 15h4" />
          </svg>
        )
      case 'STABILE/PALAZZO':
        return (
          <svg {...props}>
            <rect x="5" y="3" width="14" height="18" rx="1" />
            <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
          </svg>
        )
      case 'RUSTICO/CASALE':
        return (
          <svg {...props}>
            <path d="M3 12 12 4l9 8" />
            <path d="M5 11v8h14v-8" />
            <path d="M8 19v-4h4v4" />
            <path d="M6 11h12" />
          </svg>
        )
      case 'ATTICO':
        return (
          <svg {...props}>
            <rect x="6" y="7" width="12" height="12" rx="1" />
            <path d="M9 11h2M13 11h2M12 3v4" />
            <path d="M9 4h6" />
          </svg>
        )
      case 'VILLETTA A SCHIERA':
        return (
          <svg {...props}>
            <path d="M3 12 8 7l5 5" />
            <path d="M8 7v10H3v-5" />
            <path d="M13 12 18 7l3 3" />
            <path d="M18 7v10h-5v-5" />
          </svg>
        )
      default:
        return (
          <svg {...props}>
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        )
    }
  }

  return (
    <div className="w-full max-w-xl">
      <div className="text-xs font-semibold text-slate-700 uppercase tracking-[0.18em] mb-2">
        PASSAGGIO 2 DI 4
      </div>
      <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
        Indica la tipologia
      </h2>
      <p className="mt-3 text-sm text-gray-700 max-w-md">
        Scegli la categoria che descrive meglio il tuo immobile: ci aiuta a proporre una stima più vicina
        al reale.
      </p>

      <div className="mt-8 rounded-3xl border-2 border-slate-900 bg-white px-6 py-6 shadow-[6px_6px_0_rgba(15,23,42,1)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {types.map((type) => {
            const selected = value === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleSelect(type)}
                className={`min-h-[3.5rem] rounded-2xl px-4 py-2 flex items-start gap-3 text-left transition-colors border-2 ${
                  selected
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-900 bg-white hover:bg-slate-50'
                }`}
              >
                {getIcon(type, selected)}
                <div className="flex-1 text-[10px] sm:text-[11px] md:text-xs font-bold tracking-[0.08em] uppercase leading-snug break-all">
                  {type}
                </div>
              </button>
            )
          })}
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
            onClick={handleNext}
            className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-xs sm:text-sm font-semibold ${
              value
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

export default PropertyTypeCards
