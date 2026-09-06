import { useState } from 'react'

function ContactForm({ onSubmit, onOpenPrivacy }) {
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    privacyAccepted: false
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    
    // Rimuovi l'errore quando l'utente inizia a digitare
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.nome.trim()) {
      newErrors.nome = 'Il nome è obbligatorio'
    }
    
    if (!formData.cognome.trim()) {
      newErrors.cognome = 'Il cognome è obbligatorio'
    }
    
    if (formData.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Inserisci un indirizzo email valido'
      }
    }
    
    if (formData.telefono.trim()) {
      if (!/^\d{9,10}$/.test(formData.telefono.replace(/\s/g, ''))) {
        newErrors.telefono = 'Inserisci un numero di telefono valido'
      }
    }
    
    if (!formData.privacyAccepted) {
      newErrors.privacyAccepted = 'Devi accettare la privacy policy per procedere'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(formData)
    } catch (error) {
      if (error?.status === 429 || error?.code === 'limit_reached') {
        setSubmitError({
          type: 'limit',
          message: 'Hai già raggiunto il limite di 2 valutazioni gratuite.'
        })
      } else if (error?.status === 422 || error?.code === 'disposable_email') {
        setSubmitError({
          type: 'disposable',
          message: "L'email inserita non è accettata. Usa la tua email personale o aziendale."
        })
      } else {
        throw error
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="nome"
          className="block text-sm font-semibold text-slate-900 mb-1"
        >
          Nome *
        </label>
        <input
          type="text"
          id="nome"
          name="nome"
          value={formData.nome}
          onChange={handleChange}
          className={`w-full px-3 py-2 rounded-xl border-2 text-sm bg-white text-slate-900 ${
            errors.nome ? 'border-red-500' : 'border-slate-900'
          } focus:outline-none focus:ring-0 focus:border-slate-900`}
        />
        {errors.nome && (
          <p className="mt-1 text-xs text-red-500">{errors.nome}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="cognome"
          className="block text-sm font-semibold text-slate-900 mb-1"
        >
          Cognome *
        </label>
        <input
          type="text"
          id="cognome"
          name="cognome"
          value={formData.cognome}
          onChange={handleChange}
          className={`w-full px-3 py-2 rounded-xl border-2 text-sm bg-white text-slate-900 ${
            errors.cognome ? 'border-red-500' : 'border-slate-900'
          } focus:outline-none focus:ring-0 focus:border-slate-900`}
        />
        {errors.cognome && (
          <p className="mt-1 text-xs text-red-500">{errors.cognome}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-slate-900 mb-1"
        >
          Email *
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="esempio@email.it"
          className={`w-full px-3 py-2 rounded-xl border-2 text-sm bg-white text-slate-900 ${
            errors.email ? 'border-red-500' : 'border-slate-900'
          } focus:outline-none focus:ring-0 focus:border-slate-900`}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-500">{errors.email}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="telefono"
          className="block text-sm font-semibold text-slate-900 mb-1"
        >
          Numero di telefono *
        </label>
        <input
          type="tel"
          id="telefono"
          name="telefono"
          value={formData.telefono}
          onChange={handleChange}
          placeholder="Es. 3401234567"
          className={`w-full px-3 py-2 rounded-xl border-2 text-sm bg-white text-slate-900 ${
            errors.telefono ? 'border-red-500' : 'border-slate-900'
          } focus:outline-none focus:ring-0 focus:border-slate-900`}
        />
        {errors.telefono && (
          <p className="mt-1 text-xs text-red-500">{errors.telefono}</p>
        )}
      </div>

      <div className="pt-2">
        <div
          className={`flex items-start ${
            errors.privacyAccepted ? 'pb-1' : ''
          }`}
        >
          <div className="flex items-center h-5">
            <input
              id="privacyAccepted"
              name="privacyAccepted"
              type="checkbox"
              checked={formData.privacyAccepted}
              onChange={handleChange}
              className={`h-4 w-4 rounded border-2 ${
                errors.privacyAccepted ? 'border-red-500' : 'border-slate-900'
              } text-slate-900 focus:ring-0`}
            />
          </div>
          <div className="ml-3 text-xs sm:text-sm">
            <label htmlFor="privacyAccepted" className="text-slate-700">
              Accetto la{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  if (typeof onOpenPrivacy === 'function') {
                    onOpenPrivacy()
                  }
                }}
                className="font-semibold text-slate-900 underline underline-offset-2"
              >
                privacy policy
              </button>{' '}
              e il trattamento dei miei dati personali *
            </label>
          </div>
        </div>
        {errors.privacyAccepted && (
          <p className="text-xs text-red-500">{errors.privacyAccepted}</p>
        )}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Invio in corso...' : 'Visualizza valore immobile'}
        </button>
      </div>

      {submitError && (
        <div className={`mt-3 rounded-xl border-2 px-4 py-3 text-sm ${
          submitError.type === 'limit'
            ? 'border-amber-500 bg-amber-50 text-amber-900'
            : 'border-red-500 bg-red-50 text-red-800'
        }`}>
          <p className="font-semibold">
            {submitError.type === 'limit' ? 'Limite raggiunto' : 'Email non valida'}
          </p>
          <p className="mt-1">{submitError.message}</p>
          {submitError.type === 'limit' && (
            <a
              href="mailto:info@valutafacile.it"
              className="mt-2 inline-block font-semibold underline underline-offset-2"
            >
              Contattaci per un upgrade
            </a>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-600 mt-1 leading-snug">
        * I tuoi dati saranno utilizzati solo per fornirti informazioni sulla
        valutazione immobiliare.
      </p>
    </form>
  )
}

export default ContactForm
